const express = require('express');
const router = express.Router();
const Job = require('../../models/Job');
const TestInstance = require('../../models/TestInstance');
const SampleTransfer = require('../../models/SampleTransfer');
const { protect } = require('../../middlewares/authMiddleware');
const { cacheMiddleware } = require('../../utils/serverCache');

// GET /api/jobs/validate-ulr?number=26
// Validates a custom ULR counter number: checks duplicate + sequencing rules
router.get('/validate-ulr', protect, async (req, res) => {
  try {
    const { authorize } = require('../../middlewares/roleMiddleware');
    if (req.user.role !== 'ADMIN_OFFICER' && req.user.role !== 'ADMIN') {
        return res.status(403).json({ valid: false, error: 'Forbidden', existingJobCode: null });
    }

    const UlrCounter = require('../../models/UlrCounter');
    const requestedNum = parseInt(req.query.number, 10);

    if (isNaN(requestedNum) || requestedNum < 1) {
      return res.json({ valid: false, error: 'Must be a positive integer', existingJobCode: null });
    }

    const counter = await UlrCounter.findOne({});
    const currentMax = counter?.currentValue || 0;

    // Rule: must be <= currentMax (gap fill) or exactly currentMax + 1 (next in sequence)
    if (requestedNum > currentMax + 1) {
      return res.json({ valid: false, error: 'ULR not in sequence', existingJobCode: null });
    }

    // Build the full ULR string
    const yy = String(new Date().getFullYear()).slice(2);
    const numStr = String(requestedNum).padStart(8, '0');
    const fullUlr = `${counter?.prefix || 'TC-12434'}${yy}${numStr}`;

    // Check for duplicates
    const existing = await Job.findOne({ 'sample.ulr_no': fullUlr }, { jobCode: 1 });
    if (existing) {
      return res.json({ valid: false, error: 'Already assigned to another job', existingJobCode: existing.jobCode });
    }

    return res.json({ valid: true, error: null, existingJobCode: null, fullUlr });
  } catch (err) {
    res.status(500).json({ valid: false, error: 'Server error', existingJobCode: null });
  }
});

// GET /api/jobs/recent-ulrs
// Returns last 5 assigned ULR numbers (for convenience display in the ULR assignment UI)
router.get('/recent-ulrs', protect, async (req, res) => {
  try {
    const jobs = await Job.find(
      { 'sample.ulr_no': { $ne: null, $exists: true, $gt: '' } },
      { 'sample.ulr_no': 1, jobCode: 1 }
    ).sort({ updatedAt: -1 }).limit(5);

    const result = jobs.map(j => ({
      ulr: j.sample.ulr_no,
      jobCode: j.jobCode,
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get high-level stats for the dashboard
router.get('/stats', protect, cacheMiddleware('jobs_stats'), async (req, res) => {
  try {
    let baseQuery = { status: { $ne: 'CANCELLED' } };
    
    if (req.user.role === 'HEAD') {
      const dept = req.user.department ? req.user.department.toLowerCase() : '';
      if (dept === 'micro') {
        baseQuery['distribution.micro.required'] = true;
      } else if (dept === 'chemical') {
        baseQuery['distribution.chemical.required'] = true;
      } else {
        baseQuery._id = null;
      }
    }

    const totalJobs = await Job.countDocuments(baseQuery);
    
    // A completed job is one where all required distributions are COMPLETED
    const completedJobs = await Job.countDocuments({
      ...baseQuery,
      $and: [
        {
          $or: [
            { 'distribution.micro.required': false },
            { 'distribution.micro.status': 'COMPLETED' }
          ]
        },
        {
          $or: [
            { 'distribution.chemical.required': false },
            { 'distribution.chemical.status': 'COMPLETED' }
          ]
        }
      ]
    });

    const ongoingJobs = totalJobs - completedJobs;

    res.json({ ongoingJobs, completedJobs });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching stats' });
  }
});

// Get jobs with cursor-based pagination
router.get('/', protect, async (req, res) => {
  try {
    let query = {};
    if (req.query.includeCancelled !== 'true') {
      query.status = { $ne: 'CANCELLED' };
    }

    if (req.user.role === 'HEAD') {
      const dept = req.user.department ? req.user.department.toLowerCase() : '';
      if (dept === 'micro') {
        query['distribution.micro.required'] = true;
      } else if (dept === 'chemical') {
        query['distribution.chemical.required'] = true;
      } else {
        query._id = null;
      }

      if (req.query.activeForHead === 'true' && dept) {
        const statusField = `distribution.${dept}.status`;
        const headField = `distribution.${dept}.assignedHead`;
        
        query[statusField] = { $in: ['PENDING', 'PENDING_REVIEW', 'REVIEW_APPROVED'] };
        query.$or = [
          { [headField]: null },
          { [headField]: req.user._id }
        ];
      }
    }

    // ── Search parameter ──
    const searchTerm = req.query.search;
    if (searchTerm) {
      const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      // Search by job code, client name, or sample description
      const searchConditions = [
        { jobCode: regex },
        { clientName: regex },
        { 'sample.sampleDescription': regex },
      ];
      // Preserve any existing $or (e.g., from HEAD role filtering)
      if (query.$or) {
        query.$and = [...(query.$and || []), { $or: query.$or }, { $or: searchConditions }];
        delete query.$or;
      } else {
        query.$or = searchConditions;
      }
    }

    // ── Pagination parameters ──
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);  // max 100 per page
    const cursor = req.query.cursor;  // MongoDB _id of the last item from previous page

    if (cursor) {
      query._id = { ...(query._id || {}), $lt: cursor };
    }

    const jobs = await Job.find(query)
      .populate('createdBy', 'name email')
      .populate('parameters.parameterId', 'name unit type')
      .populate('distribution.micro.assignedHead', 'name email')
      .populate('distribution.chemical.assignedHead', 'name email')
      .populate('history.by', 'name')
      .populate('siblingJobId', 'sampleTransferState distribution headApproval jobCode sample')
      .sort({ _id: -1 })
      .limit(limit + 1);  // fetch one extra to check if there are more

    // Determine if there's a next page
    const hasMore = jobs.length > limit;
    const pageJobs = hasMore ? jobs.slice(0, limit) : jobs;
    const nextCursor = hasMore ? pageJobs[pageJobs.length - 1]._id : null;

    // Attach test instances and transfers for timeline view
    const jobsWithTimeline = await Promise.all(pageJobs.map(async (job) => {
      const instances = await TestInstance.find({ jobId: job._id })
        .populate('assignedTo', 'name')
        .populate('createdBy', 'name department')
        .populate('reviewHistory.by', 'name')
        .sort({ createdAt: 1 });
      const transfers = await SampleTransfer.find({ sampleSerial: job.sampleSerial })
        .populate('sentBy', 'name department')
        .populate('receivedBy', 'name department')
        .sort({ createdAt: 1 });
      const jobObj = job.toObject();
      if (jobObj.parameters) {
        jobObj.parameters = jobObj.parameters.filter(p => p.parameterId);
      }
      return { ...jobObj, testInstances: instances, sampleTransfers: transfers };
    }));

    return res.json({
      jobs: jobsWithTimeline,
      nextCursor,
      hasMore
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching jobs' });
  }
});

module.exports = router;
