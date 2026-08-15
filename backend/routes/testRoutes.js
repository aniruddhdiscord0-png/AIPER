const express = require('express');
const router = express.Router();

router.use('/', require('./tests/testAssignmentRoutes'));
router.use('/', require('./tests/testResultRoutes'));

module.exports = router;
