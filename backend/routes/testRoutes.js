const express = require('express');
const router = express.Router();
const TestInstance = require('../models/TestInstance');
const { protect } = require('../middlewares/authMiddleware');
const { authorize } = require('../middlewares/roleMiddleware');
const Job = require('../models/Job');
const Notification = require('../models/Notification');
const User = require('../models/User');
const ParameterGroup = require('../models/ParameterGroup');
const Parameter = require('../models/Parameter');
const { createNotification, notifyAdminOfficers, notifyAdmins } = require('../utils/notifier');
const { audit } = require('../utils/auditLogger');

// --- TEST INSTANCES ---

// Get instances based on role
router.get('/instances', protect, async (req, res) => {
  try {
    let query = {};

    if (req.user.role === 'HEAD') {
      // HEAD sees: instances they created, excluding REOPENED and CANCELLED
      query = { createdBy: req.user._id, status: { $nin: ['REOPENED', 'CANCELLED'] } };
    } else if (req.user.role === 'ADMIN_OFFICER') {
      // ADMIN_OFFICER sees all instances
      query = {};
    } else if (req.user.role === 'ASSISTANT') {
      // ASSISTANT sees: only their PENDING tasks
      query = { assignedTo: req.user._id, status: 'PENDING' };
    }
    // ADMIN sees all (no filter)

    let instances = await TestInstance.find(query)
      .populate('assignedTo', 'name')
      .populate('createdBy', 'name department')
      .populate('reviewHistory.by', 'name')
      .sort({ deadline: 1 });

    // Helper: attach sampleDescription from related Jobs
    const attachSampleDescriptions = async (docs) => {
      const jobIds = [...new Set(docs.map(i => i.jobId?.toString()))].filter(Boolean);
      const jobs = await Job.find({ _id: { $in: jobIds } }, 'sample.sample_description');
      const jobDescMap = {};
      jobs.forEach(j => { jobDescMap[j._id.toString()] = j.sample?.sample_description || ''; });
      return docs.map(doc => ({ ...doc, sampleDescription: jobDescMap[doc.jobId?.toString()] || '' }));
    };

    // Mask client name and attach sample description for ASSISTANT
    if (req.user.role === 'ASSISTANT') {
      let docs = instances.map(i => { let d = i.toObject(); d.clientName = '***HIDDEN***'; return d; });
      docs = await attachSampleDescriptions(docs);
      instances = docs;
    }

    // Attach sample description for HEAD (shown read-only in review card)
    if (req.user.role === 'HEAD') {
      let docs = instances.map(i => i.toObject());
      docs = await attachSampleDescriptions(docs);
      instances = docs;
    }

    res.json(instances);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching instances' });
  }
});

// Head dispatches tests to assistants
router.post('/instances', protect, authorize('HEAD'), async (req, res) => {
  try {
    const { jobId, deadline, assignments, blueprintId } = req.body;

    const job = await Job.findById(jobId);
    if (!job) return res.status(404).json({ message: 'Job not found' });

    const dept = req.user.department ? req.user.department.toLowerCase() : 'micro';
    const clientName = (job.customer && job.customer.customer_name) || job.clientName || '';

    // Child test code convention:
    //   Micro dept  → {jobCode}-1   e.g. 2605070001-1
    //   Chemical/Chemical dept → {jobCode}-2   e.g. 2605070001-2
    const deptSuffix = (dept === 'micro') ? '1' : '2';
    const baseTestCode = `${job.jobCode}-${deptSuffix}`;

    // Group assignments by assignedTo (assistant ID)
    const assistantMap = {};
    if (assignments && Array.isArray(assignments)) {
      // Bulk-fetch live specifications from Parameter collection (Data Settings source of truth).
      // This ensures analysts always see the current spec even if Data Settings were updated
      // after the job was created (job.parameters[].specification may be stale).
      const nonPanelIds = assignments
        .filter(a => !a.isPanel && a.parameterId)
        .map(a => a.parameterId);
      const liveParams = await Parameter.find(
        { _id: { $in: nonPanelIds } },
        'specification'
      );
      const liveSpecMap = {};
      liveParams.forEach(p => { liveSpecMap[p._id.toString()] = p.specification || ''; });

      for (const assignment of assignments) {
        const astId = assignment.assignedTo;
        if (!assistantMap[astId]) {
          assistantMap[astId] = [];
        }
        
        if (assignment.isPanel) {
          // Fetch the parameters for the specific sub-panel (GCMSMS or LCMSMS)
          const group = await ParameterGroup.findOne({ isPesticidePanel: true, pesticidePanelType: 'food' }).populate('pesticideSubPanels.parameters.parameterId');
          if (group) {
            const panel = group.pesticideSubPanels.find(p => p.panelName === assignment.panelName);
            if (panel) {
              for (const param of panel.parameters) {
                // Ensure no duplicate params just in case
                if (!assistantMap[astId].some(existing => String(existing.parameterId) === String(param.parameterId._id))) {
                  assistantMap[astId].push({
                    parameterId: param.parameterId._id,
                    name: param.name,
                    value: '',
                    unit: 'mg/kg',
                    specification: param.specification || '',
                    isPanel: true,
                    panelName: assignment.panelName
                  });
                }
              }
            }
          }
        } else {
          // Use live spec from Parameter (Data Settings). Fall back to job-time value if
          // the Parameter document was somehow not found.
          const liveSpec = liveSpecMap[String(assignment.parameterId)];
          assistantMap[astId].push({
            parameterId: assignment.parameterId,
            name: assignment.name,
            value: '',
            unit: assignment.unit,
            specification: liveSpec !== undefined ? liveSpec : (assignment.specification || '')
          });
        }
      }
    }

    const createdInstances = [];
    const assistantIds = Object.keys(assistantMap);

    for (let i = 0; i < assistantIds.length; i++) {
      const astId = assistantIds[i];
      const params = assistantMap[astId];

      // If multiple assistants under the same department, differentiate with a letter suffix
      // e.g. 2605070001-1a, 2605070001-1b
      const suffix = assistantIds.length > 1
        ? `${baseTestCode}${String.fromCharCode(97 + i)}` // a, b, c…
        : baseTestCode;

      // Check for duplicate testCode (in case of re-dispatch after reopen)
      const existingCount = await TestInstance.countDocuments({ testCode: { $regex: `^${suffix.replace(/-/g, '\\-')}` } });
      const testCode = existingCount > 0 ? `${suffix}-v${existingCount + 1}` : suffix;

      const instance = await TestInstance.create({
        jobId,
        testCode,
        clientName,
        deadline,
        assignedTo: astId,
        results: params,
        createdBy: req.user._id,
        ...(job.distribution[dept] && job.distribution[dept].reopenInfo && job.distribution[dept].reopenInfo.parentInstanceId ? {
          version: (job.distribution[dept].reopenInfo.parentVersion || 0) + 1,
          parentInstanceId: job.distribution[dept].reopenInfo.parentInstanceId
        } : {})
      });
      createdInstances.push(instance);

      // Notify Assistant
      await createNotification({
        recipient: astId,
        type: 'ACTION_REQUIRED',
        title: 'New Test Assigned',
        message: `You have been assigned test ${testCode} for job ${job.jobCode}.`,
        relatedJobId: jobId,
        relatedInstanceId: instance._id,
        link: '/assistant'
      });
    }

    // Update job distribution status
    const distDept = (dept === 'chemical') ? 'chemical' : 'micro';
    if (job.distribution && job.distribution[distDept]) {
      job.distribution[distDept].status = 'ASSIGNED_TO_ASSISTANT';
      job.distribution[distDept].reopenInfo = undefined;
      await job.save();
    }

    // Notify Admin Officers
    await notifyAdminOfficers({
      type: 'INFO',
      title: 'Job Dispatched',
      message: `${dept.toUpperCase()} HEAD has dispatched tests for job ${job.jobCode} to analysts.`,
      relatedJobId: jobId
    });

    if (req.app.get('io')) {
      req.app.get('io').emit('JOB_DISTRIBUTED');
    }

    audit('TEST_DISPATCHED', {
      req,
      message: `${dept.toUpperCase()} HEAD dispatched ${createdInstances.length} test(s) for job ${job.jobCode}`,
      target: { model: 'Job', documentId: jobId, identifier: job.jobCode }
    });

    res.status(201).json({ message: 'Dispatched successfully', instances: createdInstances });
  } catch (err) {
    res.status(500).json({ message: 'Error creating instance', error: err.message });
  }
});

// ASSISTANT saves partial progress
router.put('/instances/:id/save-progress', protect, authorize('ASSISTANT'), async (req, res) => {
  try {
    const { results, testingPeriod } = req.body;
    const instance = await TestInstance.findOne({ _id: req.params.id, assignedTo: req.user._id });

    if (!instance) return res.status(404).json({ message: 'Test not found or not assigned to you' });
    if (instance.status !== 'PENDING') return res.status(400).json({ message: 'Test is not in a submittable state' });

    instance.results = results;
    if (testingPeriod) {
      instance.testingPeriod = {
        startDate: testingPeriod.startDate || null,
        endDate: testingPeriod.endDate || null
      };
    }
    await instance.save();

    res.json(instance);
  } catch (err) {
    res.status(500).json({ message: 'Error saving progress' });
  }
});

// ASSISTANT fills in results and submits for HEAD review
router.put('/instances/:id/results', protect, authorize('ASSISTANT'), async (req, res) => {
  try {
    const { results, testingPeriod } = req.body;
    const instance = await TestInstance.findOne({ _id: req.params.id, assignedTo: req.user._id });

    if (!instance) return res.status(404).json({ message: 'Test not found or not assigned to you' });
    if (instance.status !== 'PENDING') return res.status(400).json({ message: 'Test is not in a submittable state' });

    instance.results = results;
    if (testingPeriod) {
      instance.testingPeriod = {
        startDate: testingPeriod.startDate || null,
        endDate: testingPeriod.endDate || null
      };
    }
    // Move to HEAD review — NOT completed yet
    instance.status = 'PENDING_HEAD_REVIEW';
    // Clear previousResults since this is a fresh submission
    instance.previousResults = [];

    await instance.save();

    // Delete the 'New Test Assigned' or 'Job Reassigned' notification for the assistant
    await Notification.deleteMany({
      recipient: req.user._id,
      relatedInstanceId: instance._id,
      $or: [{ title: 'New Test Assigned' }, { title: 'Job Reassigned' }]
    });

    // Notify HEAD for review
    await createNotification({
      recipient: instance.createdBy,
      type: 'ACTION_REQUIRED',
      title: 'Review Required',
      message: `Analyst has submitted results for test ${instance.testCode}. Pending your review.`,
      relatedJobId: instance.jobId,
      relatedInstanceId: instance._id,
      link: '/head/review'
    });

    if (req.app.get('io')) {
      req.app.get('io').emit('TEST_SUBMITTED');
    }

    audit('TEST_RESULTS_SUBMITTED', {
      req,
      message: `Results submitted for test ${instance.testCode}`,
      target: { model: 'TestInstance', documentId: instance._id.toString(), identifier: instance.testCode }
    });

    res.json(instance);
  } catch (err) {
    res.status(500).json({ message: 'Error updating results' });
  }
});

// HEAD reviews an instance: APPROVE (→ COMPLETED) or REASSIGN (→ PENDING)
router.put('/instances/:id/review', protect, authorize('HEAD'), async (req, res) => {
  try {
    const { action, note, selectedParams } = req.body;
    // selectedParams: [{ parameterId, assignedTo }] — only for REASSIGN with selective params
    if (!['APPROVE', 'REASSIGN'].includes(action)) {
      return res.status(400).json({ message: 'Invalid action. Must be APPROVE or REASSIGN.' });
    }

    const instance = await TestInstance.findOne({ _id: req.params.id, createdBy: req.user._id });
    if (!instance) return res.status(404).json({ message: 'Instance not found or not yours to review' });
    if (instance.status !== 'PENDING_HEAD_REVIEW') {
      return res.status(400).json({ message: 'Instance is not awaiting HEAD review' });
    }

    // Log this review action
    instance.reviewHistory.push({
      action,
      by: req.user._id,
      role: 'HEAD',
      note: note || ''
    });

    if (action === 'APPROVE') {
      instance.status = 'COMPLETED';
      instance.completedAt = new Date();
      instance.retestOnly = []; // clear any previous retest flags
      await instance.save();

      // Now update job distribution status to COMPLETED
      const job = await Job.findById(instance.jobId);
      if (job) {
        // Find all instances for this job (this now sees the saved COMPLETED status)
        const allInstances = await TestInstance.find({ jobId: instance.jobId }).populate('createdBy', 'department');
        
        // Helper to check if all instances created by a specific department are completed
        const isDeptCompleted = (deptName) => {
          const deptInstances = allInstances.filter(i => i.createdBy?.department?.toLowerCase() === deptName.toLowerCase());
          if (deptInstances.length === 0) return false;
          return deptInstances.every(i => i.status === 'COMPLETED');
        };

        if (job.distribution.micro.required && isDeptCompleted('micro')) {
          job.distribution.micro.status = 'COMPLETED';
        }
        if (job.distribution.chemical.required && (isDeptCompleted('chemical'))) {
          job.distribution.chemical.status = 'COMPLETED';
        }
        await job.save({ validateBeforeSave: false });

      }

      await notifyAdminOfficers({
        type: 'SUCCESS',
        title: 'Report Generated',
        message: `Department Head has approved test ${instance.testCode}. Report generated.`,
        relatedJobId: instance.jobId,
        relatedInstanceId: instance._id,
        link: '/admin-officer/audit'
      });
      
      await notifyAdmins({
        type: 'SUCCESS',
        title: 'Report Generated',
        message: `Test ${instance.testCode} has been finalized by Department Head.`,
        relatedJobId: instance.jobId,
        relatedInstanceId: instance._id
      });
    } else {
      // REASSIGN flow
      instance.previousResults = instance.results.map(r => ({ ...r.toObject() }));

      if (selectedParams && selectedParams.length > 0) {
        // ── Selective reassignment ──
        const selectedParamIds = selectedParams.map(sp => sp.parameterId);
        
        // Group selected params by target analyst
        const byAnalyst = {};
        for (const sp of selectedParams) {
          const targetId = sp.assignedTo || instance.assignedTo.toString();
          if (!byAnalyst[targetId]) byAnalyst[targetId] = [];
          byAnalyst[targetId].push(sp.parameterId);
        }

        const originalAssigneeId = instance.assignedTo.toString();
        const uniqueAnalysts = Object.keys(byAnalyst);

        // Check if all selected params go to the original analyst (simple case)
        if (uniqueAnalysts.length === 1 && uniqueAnalysts[0] === originalAssigneeId) {
          // Simple case: same analyst, just mark retestOnly and wipe selected param values
          instance.retestOnly = selectedParamIds;
          instance.results = instance.results.map(r => {
            const obj = r.toObject();
            if (selectedParamIds.includes(obj.parameterId)) {
              return { ...obj, value: '', testMethod: '', isSaved: false };
            }
            return obj; // keep approved values intact
          });
          instance.status = 'PENDING';
          await instance.save();

          await createNotification({
            recipient: instance.assignedTo,
            type: 'WARNING',
            title: 'Partial Retest Required',
            message: `${selectedParamIds.length} parameter(s) in test ${instance.testCode} need retesting.`,
            relatedJobId: instance.jobId,
            relatedInstanceId: instance._id,
            link: '/assistant'
          });
        } else {
          // Complex case: multiple analysts
          // The original instance keeps the params assigned to the original analyst (if any)
          const originalAnalystParams = byAnalyst[originalAssigneeId] || [];
          
          if (originalAnalystParams.length > 0) {
            // Original analyst retests some params
            instance.retestOnly = originalAnalystParams;
            instance.results = instance.results.map(r => {
              const obj = r.toObject();
              if (originalAnalystParams.includes(obj.parameterId)) {
                return { ...obj, value: '', testMethod: '', isSaved: false };
              }
              return obj;
            });
            instance.status = 'PENDING';
            await instance.save();

            await createNotification({
              recipient: instance.assignedTo,
              type: 'WARNING',
              title: 'Partial Retest Required',
              message: `${originalAnalystParams.length} parameter(s) in test ${instance.testCode} need retesting.`,
              relatedJobId: instance.jobId,
              relatedInstanceId: instance._id,
              link: '/assistant'
            });
          } else {
            // Original analyst has no params to retest — keep instance but mark it waiting
            // We'll set retestOnly to empty and status stays PENDING_HEAD_REVIEW until
            // the split instances complete and merge back. Actually, simpler approach:
            // mark original instance as waiting for the splits to complete.
            instance.retestOnly = [];
            instance.status = 'PENDING'; // will be re-submitted once splits merge
            // Wipe only selected params
            instance.results = instance.results.map(r => {
              const obj = r.toObject();
              if (selectedParamIds.includes(obj.parameterId)) {
                return { ...obj, value: '', testMethod: '', isSaved: false };
              }
              return obj;
            });
            await instance.save();
          }

          // Create new instances for other analysts
          for (const [analystId, paramIds] of Object.entries(byAnalyst)) {
            if (analystId === originalAssigneeId) continue; // already handled above

            // Build results array with only the params for this analyst (wiped)
            const analystResults = instance.previousResults
              .filter(r => paramIds.includes(r.parameterId))
              .map(r => ({
                ...r.toObject(),
                value: '',
                testMethod: '',
                isSaved: false,
                assignedTo: analystId
              }));

            // Create a sub-instance linked to the parent
            const subInstance = new TestInstance({
              jobId: instance.jobId,
              testCode: `${instance.testCode}-R${Date.now().toString(36).slice(-4)}`,
              clientName: instance.clientName,
              deadline: instance.deadline,
              assignedTo: analystId,
              status: 'PENDING',
              results: analystResults,
              retestOnly: paramIds,
              reviewHistory: [],
              createdBy: req.user._id,
              version: instance.version,
              parentInstanceId: instance._id
            });
            await subInstance.save();

            await createNotification({
              recipient: analystId,
              type: 'WARNING',
              title: 'Retest Assigned',
              message: `You have been assigned ${paramIds.length} parameter(s) for retest on ${instance.testCode}.`,
              relatedJobId: instance.jobId,
              relatedInstanceId: subInstance._id,
              link: '/assistant'
            });
          }
        }
      } else {
        // ── Legacy: full reassignment (all params wiped) ──
        instance.retestOnly = [];
        instance.results = instance.results.map(r => ({
          ...r.toObject(),
          value: ''
        }));
        instance.status = 'PENDING';
        await instance.save();

        await createNotification({
          recipient: instance.assignedTo,
          type: 'WARNING',
          title: 'Job Reassigned',
          message: `Your results for test ${instance.testCode} were rejected by HEAD. Please revise.`,
          relatedJobId: instance.jobId,
          relatedInstanceId: instance._id,
          link: '/assistant'
        });
      }

      await notifyAdminOfficers({
        type: 'INFO',
        title: 'Job Reassigned by HEAD',
        message: `HEAD rejected results for test ${instance.testCode} and sent it back for retesting.`,
        relatedJobId: instance.jobId,
        relatedInstanceId: instance._id
      });
    }

    if (req.app.get('io')) {
      req.app.get('io').emit('TEST_REVIEWED');
    }

    audit('TEST_REVIEWED', {
      req,
      message: `Test ${instance.testCode} ${action === 'approve' ? 'approved' : 'reassigned'} by HEAD`,
      target: { model: 'TestInstance', documentId: instance._id.toString(), identifier: instance.testCode }
    });

    res.json(instance);
  } catch (err) {
    console.error('Error processing review:', err);
    res.status(500).json({ message: 'Error processing review', error: err.message });
  }
});



// ADMIN_OFFICER reopens a completed instance
router.post('/instances/:id/reopen', protect, authorize('ADMIN_OFFICER'), async (req, res) => {
  try {
    const { reopenNote, assignedHeadId } = req.body;
    if (!reopenNote) return res.status(400).json({ message: 'Reopen note is required' });

    const instance = await TestInstance.findById(req.params.id);
    if (!instance) return res.status(404).json({ message: 'Instance not found' });
    if (instance.status !== 'COMPLETED') {
      return res.status(400).json({ message: 'Only completed instances can be reopened' });
    }

    // Mark old instance as REOPENED
    instance.status = 'REOPENED';
    instance.reopenNote = reopenNote;
    instance.reopenedBy = req.user._id;
    await instance.save();

    // Reset Job distribution status to PENDING and store reopenInfo
    const job = await Job.findById(instance.jobId);
    if (job) {
      // Determine which department this instance belongs to
      const dept = ['micro', 'chemical'].find(d => {
        return job.distribution[d]?.required &&
          String(job.distribution[d]?.assignedTo) === String(instance.createdBy);
      });

      if (dept) {
        job.distribution[dept].status = 'PENDING';
        job.distribution[dept].reopenInfo = {
          parentInstanceId: instance._id,
          parentVersion: instance.version,
          note: reopenNote
        };
        // Optionally change the assigned HEAD
        if (assignedHeadId) {
          job.distribution[dept].assignedTo = assignedHeadId;
        }
        await job.save();
      }
    }

    res.json({ message: 'Job reopened successfully', reopenedInstance: instance });
  } catch (err) {
    res.status(500).json({ message: 'Error reopening instance', error: err.message });
  }
});

// Get version history for an instance (walk the parentInstanceId chain)
router.get('/instances/:id/history', protect, async (req, res) => {
  try {
    const versions = [];
    let currentId = req.params.id;

    // Start from the requested instance and walk backwards
    while (currentId) {
      const inst = await TestInstance.findById(currentId)
        .populate('blueprintId', 'name')
        .populate('assignedTo', 'name')
        .populate('createdBy', 'name department')
        .populate('reviewHistory.by', 'name')
        .populate('reopenedBy', 'name');
      if (!inst) break;
      versions.push(inst);
      currentId = inst.parentInstanceId;
    }

    // Also check if there are newer versions pointing to this instance
    let newerVersionId = req.params.id;
    while (true) {
      const newer = await TestInstance.findOne({ parentInstanceId: newerVersionId })
        .populate('blueprintId', 'name')
        .populate('assignedTo', 'name')
        .populate('createdBy', 'name department')
        .populate('reviewHistory.by', 'name')
        .populate('reopenedBy', 'name');
      if (!newer) break;
      versions.unshift(newer); // Add newer versions at the front
      newerVersionId = newer._id;
    }

    // Sort by version descending (newest first)
    versions.sort((a, b) => b.version - a.version);

    res.json(versions);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching version history', error: err.message });
  }
});

module.exports = router;
