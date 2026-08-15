const express = require('express');
const router = express.Router();
const TestInstance = require('../../models/TestInstance');
const Job = require('../../models/Job');
const ParameterGroup = require('../../models/ParameterGroup');
const Parameter = require('../../models/Parameter');
const User = require('../../models/User');
const Notification = require('../../models/Notification');
const { protect } = require('../../middlewares/authMiddleware');
const { authorize } = require('../../middlewares/roleMiddleware');
const { createNotification, notifyAdminOfficers } = require('../../utils/notifier');
const { audit } = require('../../utils/auditLogger');

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

module.exports = router;
