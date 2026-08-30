const UlrCounter = require('../models/UlrCounter');
const { getNextUlr } = require('./serialUtils');

/**
 * Evaluates if a job has completed all its required testing phases.
 * Reads from job.distribution (authoritative status) rather than counting
 * individual TestInstance documents, so it is immune to the createdBy.department
 * population bug on older instances.
 *
 * @param {Object} job - Mongoose Job document
 * @returns {boolean}
 */
function isJobFullyTested(job) {
  const microOk = !job.distribution?.micro?.required
    || job.distribution.micro.status === 'COMPLETED';
  const chemOk = !job.distribution?.chemical?.required
    || job.distribution.chemical.status === 'COMPLETED';
  return microOk && chemOk;
}

/**
 * Isolated ULR assignment logic. Call this right before job.save() inside
 * the HEAD APPROVE block in testResultRoutes.js.
 *
 * Eligibility rules:
 *   - Job must not already have a ulr_no set (idempotent guard)
 *   - Job must be fully tested (all required depts COMPLETED)
 *   - Job must be NABL (auto-assign) OR have a reservedUlrSlot (Non-NABL opt-in)
 *
 * Mutates job in-place. Returns true if a ULR was assigned (caller must save).
 *
 * @param {Object} job - Mongoose Job document (already mutated with dept statuses)
 * @param {Object} reqUser - req.user from the express request
 * @returns {Promise<boolean>}
 */
async function attemptUlrAssignment(job, reqUser) {
  // Guard: already assigned
  if (job.sample?.ulr_no) return false;

  // Guard: testing not done yet
  if (!isJobFullyTested(job)) return false;

  const isNabl = job.sample?.nabl_type === 'Nabl';
  const hasReservation = job.reservedUlrSlot != null;

  // Guard: not eligible for a ULR
  if (!isNabl && !hasReservation) return false;

  let assignedUlr;

  if (hasReservation) {
    // Non-NABL opt-in path: consume the reserved slot.
    // Use the year that was stored at reservation time to prevent year-rollover
    // collisions (a job reserved in Dec 2026 must use year '26', not '27').
    const counter = await UlrCounter.findOne({});
    const yy = job.reservedUlrYear || String(new Date().getFullYear()).slice(2);
    const numStr = String(job.reservedUlrSlot).padStart(8, '0');
    assignedUlr = `${counter?.prefix || 'TC-12434'}${yy}${numStr}`;
    // Clear reservation fields now that the ULR is official
    job.reservedUlrSlot = null;
    job.reservedUlrYear = null;
  } else {
    // Standard NABL auto-assignment: increment counter and build string
    assignedUlr = await getNextUlr();
  }

  job.sample.ulr_no = assignedUlr;
  job.history.push({
    action: 'ULR_ASSIGNED',
    by: reqUser._id,
    note: `ULR ${assignedUlr} officially assigned upon test completion`
  });

  return true;
}

module.exports = { attemptUlrAssignment, isJobFullyTested };
