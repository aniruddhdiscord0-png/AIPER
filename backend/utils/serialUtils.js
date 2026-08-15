const Job = require('../models/Job');
const SampleCounter = require('../models/SampleCounter');
const UlrCounter = require('../models/UlrCounter');

/**
 * Build a 10-digit job code:  YYMMDD + 4-digit zero-padded serial
 * e.g. serial 1001 on 7 May 2026  →  "2605071001"
 */
function buildJobCode(serial, dateStr) {
  const serialStr = String(serial);
  const nn = serialStr.length >= 8
    ? serialStr.slice(-4)          // already a full code — keep last 4
    : serialStr.slice(-4).padStart(4, '0');

  // If a custom date string (YYYY-MM-DD) was supplied, use its prefix
  if (dateStr) {
    const [yyyy, mm, dd] = dateStr.split('-');
    const yy = String(yyyy).slice(2);
    return `${yy}${mm}${dd}${nn}`;
  }

  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yy}${mm}${dd}${nn}`;
}

/**
 * Atomically increment and return the next sample serial.
 * @param {string} [customDate] - Optional YYYY-MM-DD date to embed in the job code prefix.
 *   If omitted, today's real date is used. The underlying counter always
 *   increments normally so midnight rollover is never affected.
 */
async function getNextSerial(customDate) {
  const today = new Date().toISOString().split('T')[0];
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const todayPrefix = `${yy}${mm}${dd}`;

  let counter = await SampleCounter.findOne({});
  if (!counter) {
    const start = parseInt(process.env.SAMPLE_ID_START || '1000', 10);
    const last = await Job.findOne({}, { sampleSerial: 1 }, { sort: { sampleSerial: -1 } });
    const initialValue = last && last.sampleSerial ? last.sampleSerial : start;
    counter = await SampleCounter.create({ currentValue: initialValue, lastUpdatedDate: today });
  }

  let nextSerial;

  if (counter.lastUpdatedDate && counter.lastUpdatedDate !== today) {
    // Real day rolled over — snap counter to today's prefix, then increment
    const stringVal = String(counter.currentValue);
    const serialPart = stringVal.length >= 8 ? stringVal.slice(-4) : stringVal.padStart(4, '0');
    const newMassiveCounter = parseInt(`${todayPrefix}${serialPart}`, 10);
    const updated = await SampleCounter.findOneAndUpdate(
      {},
      { $set: { currentValue: newMassiveCounter + 1, lastUpdatedDate: today } },
      { new: true }
    );
    nextSerial = updated.currentValue;
  } else {
    // Same day (or freshly created) — just increment
    const updated = await SampleCounter.findOneAndUpdate(
      {},
      { $inc: { currentValue: 1 }, $set: { lastUpdatedDate: today } },
      { new: true }
    );
    nextSerial = updated.currentValue;
  }

  // If a custom date was requested, overlay its YYMMDD prefix onto the serial
  // while keeping the same incrementing 4-digit suffix.
  if (customDate && customDate !== today) {
    const [yyyy, cmm, cdd] = customDate.split('-');
    const cyy = String(yyyy).slice(2);
    const suffix = String(nextSerial).slice(-4).padStart(4, '0');
    return parseInt(`${cyy}${cmm}${cdd}${suffix}`, 10);
  }

  return nextSerial;
}

/**
 * Atomically increment and return the next ULR string.
 * Format: TC-XXXXXYYNNNNNNNN  (prefix + 2-digit year + 8-digit running number)
 * The running number resets to 1 when the calendar year changes.
 */
async function getNextUlr() {
  const yy = String(new Date().getFullYear()).slice(2);
  let counter = await UlrCounter.findOne({});

  // Year-based reset: if the stored year differs from current, reset counter
  if (counter && counter.lastYear && counter.lastYear !== yy) {
    counter.currentValue = 0; // will be incremented to 1 below
    counter.lastYear = yy;
    await counter.save();
  }

  counter = await UlrCounter.findOneAndUpdate(
    {},
    { $inc: { currentValue: 1 }, $set: { lastYear: yy } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  const numStr = String(counter.currentValue).padStart(8, '0');
  // ULR Code: prefix + YY + 8-digit-counter (no suffix)
  return `${counter.prefix}${yy}${numStr}`;
}

module.exports = { buildJobCode, getNextSerial, getNextUlr };
