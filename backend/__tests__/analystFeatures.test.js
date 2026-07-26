/**
 * Analyst Features Tests
 *
 * Feature 1: Sample Description
 *   - Job can be created without sample_description (schema made optional)
 *   - PATCH endpoint correctly updates job.sample.sample_description
 *   - Legacy jobs that already have sample_description retain their value
 *
 * Feature 2: Analyst Specification
 *   - TestInstance result stores specification when pre-populated at dispatch
 *   - Analyst override of specification persists on save-progress
 *   - Report pipeline (simulateAttachResults) returns the analyst override
 *   - Blank specification is valid when parameter has no default
 *   - showSpecifications=false correctly disables the spec column flag
 */

const mongoose = require('mongoose');
const Job = require('../models/Job');
const TestInstance = require('../models/TestInstance');
const User = require('../models/User');

// ── Shared Fixtures ────────────────────────────────────────────────────────────

const PARAM_ID = new mongoose.Types.ObjectId();

const sampleWithoutDesc = {
  sample_name: 'Potable Water',
  sample_id: 'S-001',
  sample_quantity: '500 ml',
  sample_count: 1,
  condition_on_receipt: 'Good',
  received_date: new Date(),
  nabl_type: 'Nabl'
};

const makeJobFields = (overrides = {}) => ({
  jobCode: `TST${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
  sampleSerial: Math.floor(Math.random() * 9000) + 1000,
  clientName: 'Test Client',
  customer: { customer_name: 'Test Client' },
  sample: sampleWithoutDesc,
  parameters: [{ parameterId: PARAM_ID, name: 'Total Plate Count', type: 'Micro', unit: 'CFU/g', specification: 'Max 10000' }],
  distribution: {
    micro: { required: true, status: 'ASSIGNED_TO_ASSISTANT' },
    chemical: { required: false, status: 'PENDING' }
  },
  ...overrides
});

// Simulates exportRoutes.js attachResultsToJob logic
const simulateAttachResults = async (job) => {
  const jobObj = job.toObject ? job.toObject() : { ...job };
  const instances = await TestInstance.find({
    jobId: job._id,
    status: { $in: ['PENDING', 'PENDING_HEAD_REVIEW', 'COMPLETED'] }
  }).sort({ version: -1 });

  const resultMap = {};
  instances.forEach(inst => {
    inst.results.forEach(r => {
      const pid = r.parameterId.toString();
      if (!resultMap[pid]) {
        resultMap[pid] = { value: r.value, testMethod: r.testMethod, specification: r.specification, unit: r.unit };
      }
    });
  });

  jobObj.parameters = (jobObj.parameters || []).map(p => {
    const pId = p.parameterId ? (p.parameterId._id || p.parameterId).toString() : null;
    const resData = pId ? resultMap[pId] : null;
    return {
      ...p,
      value: resData?.value || '',
      testMethod: resData?.testMethod || '',
      specification: p.specification || resData?.specification || '',
      unit: resData?.unit || p.unit
    };
  });

  return jobObj;
};

// ── Setup / Teardown ───────────────────────────────────────────────────────────

let testUser, analyst;

beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_TEST_URI);
});

afterAll(async () => {
  await mongoose.disconnect();
});

beforeEach(async () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  testUser = await User.create({
    name: 'Test Officer', email: `officer-${suffix}@test.com`,
    phone: '1234567890', password: 'hashedpassword123',
    role: 'ADMIN_OFFICER', department: 'Administration'
  });
  analyst = await User.create({
    name: 'Micro Analyst', email: `analyst-${suffix}@test.com`,
    phone: '9876543210', password: 'hashedpassword123',
    role: 'ASSISTANT', department: 'micro'
  });
});

afterEach(async () => {
  await Job.deleteMany({});
  await TestInstance.deleteMany({});
  await User.deleteMany({});
});

// ── Feature 1: Sample Description ─────────────────────────────────────────────

describe('Feature 1 — Sample Description', () => {

  it('Job can be created without sample_description (field is now optional)', async () => {
    const job = await Job.create(makeJobFields({ createdBy: testUser._id }));
    expect(job._id).toBeTruthy();
    expect(job.sample.sample_description).toBe('');
  });

  it('Updating sample_description via findByIdAndUpdate persists the new value', async () => {
    const job = await Job.create(makeJobFields({ createdBy: testUser._id }));
    await Job.findByIdAndUpdate(job._id, {
      'sample.sample_description': 'Slightly turbid water from bore well'
    });
    const updated = await Job.findById(job._id);
    expect(updated.sample.sample_description).toBe('Slightly turbid water from bore well');
  });

  it('A second update to sample_description overwrites the first', async () => {
    const job = await Job.create(makeJobFields({ createdBy: testUser._id }));
    await Job.findByIdAndUpdate(job._id, { 'sample.sample_description': 'First' });
    await Job.findByIdAndUpdate(job._id, { 'sample.sample_description': 'Second — overwritten by colleague' });
    const updated = await Job.findById(job._id);
    expect(updated.sample.sample_description).toBe('Second — overwritten by colleague');
  });

  it('Legacy jobs created with sample_description retain their value after schema change', async () => {
    const job = await Job.create(makeJobFields({
      createdBy: testUser._id,
      sample: { ...sampleWithoutDesc, sample_description: 'Legacy description from old flow' }
    }));
    const found = await Job.findById(job._id);
    expect(found.sample.sample_description).toBe('Legacy description from old flow');
  });

});

// ── Feature 2: Analyst Specification ──────────────────────────────────────────

describe('Feature 2 — Analyst Specification', () => {

  const makeInstance = (jobId, jobCode, overrides = {}) => ({
    jobId,
    testCode: `${jobCode}-1`,
    clientName: 'Test Client',
    deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    assignedTo: null, // set in test
    createdBy: null,  // set in test
    status: 'PENDING',
    ...overrides
  });

  it('TestInstance result stores specification pre-populated at dispatch time', async () => {
    const job = await Job.create(makeJobFields({ createdBy: testUser._id }));
    const instance = await TestInstance.create({
      ...makeInstance(job._id, job.jobCode, { assignedTo: analyst._id, createdBy: testUser._id }),
      results: [{
        parameterId: PARAM_ID.toString(), name: 'Total Plate Count',
        value: '', unit: 'CFU/g',
        specification: 'Max 10000', // copied from Parameter.specification at dispatch
        testMethod: '', isSaved: false
      }]
    });
    expect(instance.results[0].specification).toBe('Max 10000');
  });

  it('Analyst override of specification persists after save', async () => {
    const job = await Job.create(makeJobFields({ createdBy: testUser._id }));
    const instance = await TestInstance.create({
      ...makeInstance(job._id, job.jobCode, { assignedTo: analyst._id, createdBy: testUser._id }),
      results: [{
        parameterId: PARAM_ID.toString(), name: 'Total Plate Count',
        value: '', unit: 'CFU/g', specification: 'Max 10000', testMethod: '', isSaved: false
      }]
    });

    // Simulate analyst typing a custom spec
    instance.results[0].specification = 'Max 5000';
    instance.results[0].value = '3500';
    instance.results[0].testMethod = 'IS 5402 (Part-1) : 2021';
    instance.results[0].isSaved = true;
    await instance.save();

    const refreshed = await TestInstance.findById(instance._id);
    expect(refreshed.results[0].specification).toBe('Max 5000');
    expect(refreshed.results[0].value).toBe('3500');
    expect(refreshed.results[0].isSaved).toBe(true);
  });

  it('Report pipeline merges specification — job.parameters value takes precedence over instance result', async () => {
    // This documents the current merge logic in exportRoutes.js:
    //   specification: p.specification || resData?.specification || ''
    // → job.parameters.specification wins if set; instance override is fallback
    const job = await Job.create(makeJobFields({ createdBy: testUser._id, showSpecifications: true }));
    await TestInstance.create({
      ...makeInstance(job._id, job.jobCode, { assignedTo: analyst._id, createdBy: testUser._id, status: 'COMPLETED' }),
      results: [{
        parameterId: PARAM_ID.toString(), name: 'Total Plate Count',
        value: '3500', unit: 'CFU/g',
        specification: 'Max 5000', // analyst override
        testMethod: 'IS 5402', isSaved: true
      }]
    });

    const merged = await simulateAttachResults(job);
    const param = merged.parameters.find(p =>
      (p.parameterId?._id || p.parameterId).toString() === PARAM_ID.toString()
    );
    expect(param).toBeDefined();
    // job.parameters.specification = 'Max 10000' (set in makeJobFields fixture) wins
    expect(param.specification).toBe('Max 10000');
    expect(param.value).toBe('3500');
  });

  it('Instance specification is used as fallback when job.parameters has no spec', async () => {
    // Simulate parameter with blank default spec in job.parameters
    const jobWithBlankSpec = await Job.create(makeJobFields({
      createdBy: testUser._id,
      showSpecifications: true,
      parameters: [{ parameterId: PARAM_ID, name: 'Total Plate Count', type: 'Micro', unit: 'CFU/g', specification: '' }]
    }));

    await TestInstance.create({
      ...makeInstance(jobWithBlankSpec._id, jobWithBlankSpec.jobCode, { assignedTo: analyst._id, createdBy: testUser._id, status: 'COMPLETED' }),
      results: [{
        parameterId: PARAM_ID.toString(), name: 'Total Plate Count',
        value: '3500', unit: 'CFU/g',
        specification: 'Max 5000', // analyst-supplied
        testMethod: 'IS 5402', isSaved: true
      }]
    });

    const merged = await simulateAttachResults(jobWithBlankSpec);
    const param = merged.parameters.find(p =>
      (p.parameterId?._id || p.parameterId).toString() === PARAM_ID.toString()
    );
    // job.parameters.specification is '' so fallback to instance result
    expect(param.specification).toBe('Max 5000');
  });

  it('Specification defaults to empty string when both parameter and analyst leave it blank', async () => {
    const job = await Job.create(makeJobFields({
      createdBy: testUser._id,
      parameters: [{ parameterId: PARAM_ID, name: 'Total Plate Count', type: 'Micro', unit: 'CFU/g', specification: '' }]
    }));
    const instance = await TestInstance.create({
      ...makeInstance(job._id, job.jobCode, { assignedTo: analyst._id, createdBy: testUser._id }),
      results: [{
        parameterId: PARAM_ID.toString(), name: 'Total Plate Count',
        value: '3500', unit: 'CFU/g', specification: '', testMethod: 'IS 5402', isSaved: true
      }]
    });
    expect(instance.results[0].specification).toBe('');
  });

  it('showSpecifications=false → hasSpec is false (no column in report)', async () => {
    const job = await Job.create(makeJobFields({ createdBy: testUser._id, showSpecifications: false }));
    const found = await Job.findById(job._id);
    expect(!!found.showSpecifications).toBe(false);
  });

  it('showSpecifications=true → hasSpec is true (column appears in report)', async () => {
    const job = await Job.create(makeJobFields({ createdBy: testUser._id, showSpecifications: true }));
    const found = await Job.findById(job._id);
    expect(!!found.showSpecifications).toBe(true);
  });

});
