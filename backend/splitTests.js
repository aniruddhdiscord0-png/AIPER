const fs = require('fs');
const lines = fs.readFileSync('routes/testRoutes.js', 'utf8').split('\n');

const assignmentRoutes = lines.slice(15, 218).join('\n');
const resultRoutes = lines.slice(219, 636).join('\n');

const assignmentTemplate = `const express = require('express');
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

${assignmentRoutes}

module.exports = router;
`;

const resultTemplate = `const express = require('express');
const router = express.Router();
const TestInstance = require('../../models/TestInstance');
const Job = require('../../models/Job');
const Notification = require('../../models/Notification');
const { protect } = require('../../middlewares/authMiddleware');
const { authorize } = require('../../middlewares/roleMiddleware');
const { createNotification, notifyAdminOfficers, notifyAdmins } = require('../../utils/notifier');
const { audit } = require('../../utils/auditLogger');

${resultRoutes}

module.exports = router;
`;

fs.mkdirSync('routes/tests', { recursive: true });
fs.writeFileSync('routes/tests/testAssignmentRoutes.js', assignmentTemplate);
fs.writeFileSync('routes/tests/testResultRoutes.js', resultTemplate);

const routerTemplate = `const express = require('express');
const router = express.Router();

router.use('/', require('./tests/testAssignmentRoutes'));
router.use('/', require('./tests/testResultRoutes'));

module.exports = router;
`;
fs.writeFileSync('routes/testRoutes.js', routerTemplate);
console.log('done');
