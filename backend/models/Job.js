const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  // jobCode = YYMMDD + NNNN  e.g. "2605070001"  (10 digits, globally unique)
  jobCode: { type: String, required: true, unique: true },
  // sampleSerial = the 4-digit numeric part, e.g. 1001
  sampleSerial: { type: Number, required: true },

  // Legacy field — kept for backward compat, auto-populated from customer.customer_name on create
  clientName: { type: String },
  totalSampleVolume: { type: Number },
  status: { type: String, enum: ['ACTIVE', 'CANCELLED'], default: 'ACTIVE' },
  cancelledAt: { type: Date },
  cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // --- Parameter System ---
  groupMetadata: {
    group: { type: String },
    subGroup: { type: String },
    productCategory: { type: String }
  },
  pesticidePanel: {
    enabled: { type: Boolean, default: false },
    panelType: { type: String, enum: ['food', null], default: null }
  },
  parameters: [{
    parameterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Parameter' },
    name: { type: String },
    type: { type: String, enum: ['Micro', 'Chemical'] },
    unit: { type: String },
    specification: { type: String, default: '' }
  }],

  // --- Customer Information ---
  customer: {
    customer_name: { type: String, required: true },
    customer_address: { type: String },
    contact_person: { type: String },
    mobile_number: { type: String },
    email: { type: String },
    customer_reference_no: { type: String },
    batch_no: { type: String },
    dom: { type: String },
    brand_name: { type: String },
    any_other_info: { type: String },
    batch_size: { type: String },
    doe: { type: String }
  },

  // --- Sample Information ---
  sample: {
    sample_name: { type: String, required: true },
    sample_id: { type: String, required: true },
    sample_quantity: { type: String, required: true }, // e.g. "500 ml", "2 kg"
    sample_count: { type: Number, required: true, min: 1, default: 1 },
    sample_description: { type: String, default: '' },

    condition_on_receipt: { type: String, required: true },
    packing_details: { type: String },
    marking_seal: { type: String },
    sample_source: { type: String },
    received_date: { type: Date, required: true },
    received_mode: { type: String },
    nabl_type: { type: String, enum: ['Nabl', 'Non Nabl', 'Hybrid'] },
    ulr_no: { type: String },
    test_parameters: [{ type: String }]
  },

  // --- Compliance & Legal Information ---
  compliance: {
    statement_of_conformity: { type: String },
    decision_rule: { type: String },
    accreditation_scope: { type: String },
    disclaimer_notes: { type: String },
    special_handling_instructions: { type: String }
  },
  showSpecifications: { type: Boolean, default: false },
  distribution: {
    micro: {
      required: { type: Boolean, default: false },
      assignedHead: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      status: { type: String, enum: ['PENDING', 'PENDING_REVIEW', 'REVIEW_APPROVED', 'ASSIGNED_TO_ASSISTANT', 'RETURNED', 'COMPLETED'], default: 'PENDING' },
      reopenInfo: {
        parentInstanceId: { type: mongoose.Schema.Types.ObjectId, ref: 'TestInstance' },
        parentVersion: { type: Number },
        note: { type: String }
      }
    },
    chemical: {
      required: { type: Boolean, default: false },
      assignedHead: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      status: { type: String, enum: ['PENDING', 'PENDING_REVIEW', 'REVIEW_APPROVED', 'ASSIGNED_TO_ASSISTANT', 'RETURNED', 'COMPLETED'], default: 'PENDING' },
      reopenInfo: {
        parentInstanceId: { type: mongoose.Schema.Types.ObjectId, ref: 'TestInstance' },
        parentVersion: { type: Number },
        note: { type: String }
      }
    }
  },
  // Head Approval Tracking (universal approval gate)
  headApproval: {
    micro: { type: Boolean, default: false },
    chemical: { type: Boolean, default: false }
  },
  // Sample Transfer State Machine
  sampleTransferState: {
    type: String,
    enum: ['NOT_REQUIRED', 'PENDING_APPROVAL', 'PENDING_TRANSFER', 'IN_TRANSIT', 'ACCEPTED'],
    default: 'NOT_REQUIRED'
  },
  sampleFlow: {
    type: { type: String, enum: ['PARALLEL', 'SEQUENTIAL'], default: 'PARALLEL' },
    firstDepartment: { type: String, enum: ['micro', 'chemical'], default: 'micro' },
    transferDeadline: { type: Date }
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // Job History Timeline
  history: [{
    action: { type: String, enum: ['CREATED', 'DISPATCHED', 'RETURNED_TO_OFFICER', 'RESUBMITTED', 'RETEST_REQUESTED', 'COMPLETED', 'UPDATED', 'REVIEW_APPROVED', 'REPORT_UPLOADED', 'REPORT_REVERTED'] },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    note: { type: String },
    timestamp: { type: Date, default: Date.now }
  }],

  // Retest/Reopen Fields
  isRetest: { type: Boolean, default: false },
  parentJobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', default: null },
  siblingJobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', default: null },
  reopenReason: { type: String, default: null },
  retestNumber: { type: Number, default: 0 },

  // Officer-specified creation date (overrides the date prefix in jobCode when set)
  customCreationDate: { type: Date, default: null },
}, { timestamps: true });

// ── Performance indexes ─────────────────────────────────────────────────────
jobSchema.index({ 'distribution.micro.status': 1 });
jobSchema.index({ 'distribution.chemical.status': 1 });
jobSchema.index({ status: 1 });
jobSchema.index({ createdAt: -1 });
jobSchema.index({ 'sample.nabl_type': 1 });
jobSchema.index({ sampleSerial: -1 });
jobSchema.index({ isRetest: 1, parentJobId: 1 });

module.exports = mongoose.model('Job', jobSchema);
