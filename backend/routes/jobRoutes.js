const express = require('express');
const router = express.Router();

// Sub-routers by concern
router.use('/', require('./jobs/jobListRoutes'));
router.use('/', require('./jobs/jobCrudRoutes'));
router.use('/', require('./jobs/jobWorkflowRoutes'));

module.exports = router;
