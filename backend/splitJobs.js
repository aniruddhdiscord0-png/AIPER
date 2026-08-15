const fs = require('fs');
const lines = fs.readFileSync('routes/jobRoutes.js', 'utf8').split('\n');

const listRoutes = lines.slice(133, 183).join('\n');
const crudRoutesPart1 = lines.slice(18, 133).join('\n');
const crudRoutesPart2 = lines.slice(184, 644).join('\n');
const workflowRoutes = lines.slice(645, 948).join('\n');

const listTemplate = `const express = require('express');
const router = express.Router();
const Job = require('../../models/Job');
const TestInstance = require('../../models/TestInstance');
const SampleTransfer = require('../../models/SampleTransfer');
const { protect } = require('../../middlewares/authMiddleware');

${listRoutes}

module.exports = router;
`;

const crudTemplate = `const express = require('express');
const router = express.Router();
const Job = require('../../models/Job');
const TestInstance = require('../../models/TestInstance');
const SampleTransfer = require('../../models/SampleTransfer');
const User = require('../../models/User');
const UlrCounter = require('../../models/UlrCounter');
const SampleCounter = require('../../models/SampleCounter');
const { protect } = require('../../middlewares/authMiddleware');
const { authorize } = require('../../middlewares/roleMiddleware');
const { createNotification, notifyAdmins, notifyAdminOfficers } = require('../../utils/notifier');
const { audit } = require('../../utils/auditLogger');
const { computeDelta, applyAdditions, applyRemovals, invalidateCustomReports } = require('../../utils/parameterDelta');
const { buildJobCode, getNextSerial, getNextUlr } = require('../../utils/serialUtils');

${crudRoutesPart1}
${crudRoutesPart2}

module.exports = router;
`;

const workflowTemplate = `const express = require('express');
const router = express.Router();
const Job = require('../../models/Job');
const TestInstance = require('../../models/TestInstance');
const SampleTransfer = require('../../models/SampleTransfer');
const User = require('../../models/User');
const { protect } = require('../../middlewares/authMiddleware');
const { authorize } = require('../../middlewares/roleMiddleware');
const { createNotification, notifyAdminOfficers, notifyAdmins } = require('../../utils/notifier');
const { audit } = require('../../utils/auditLogger');

${workflowRoutes}

module.exports = router;
`;

fs.mkdirSync('routes/jobs', { recursive: true });
fs.writeFileSync('routes/jobs/jobListRoutes.js', listTemplate);
fs.writeFileSync('routes/jobs/jobCrudRoutes.js', crudTemplate);
fs.writeFileSync('routes/jobs/jobWorkflowRoutes.js', workflowTemplate);

const routerTemplate = `const express = require('express');
const router = express.Router();

// Sub-routers by concern
router.use('/', require('./jobs/jobListRoutes'));
router.use('/', require('./jobs/jobCrudRoutes'));
router.use('/', require('./jobs/jobWorkflowRoutes'));

module.exports = router;
`;
fs.writeFileSync('routes/jobRoutes.js', routerTemplate);
console.log('done');
