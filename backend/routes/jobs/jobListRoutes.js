const express = require('express');
const router = express.Router();
const Job = require('../../models/Job');
const TestInstance = require('../../models/TestInstance');
const SampleTransfer = require('../../models/SampleTransfer');
const { protect } = require('../../middlewares/authMiddleware');
const { cacheMiddleware } = require('../../utils/serverCache');

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
