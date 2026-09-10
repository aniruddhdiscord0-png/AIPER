/**
 * codeUtils.js
 * Utilities for formatting test/job codes in the AIPER frontend UI.
 */

/**
 * Format a test code for display by stripping department and analyst suffixes.
 *
 * Rules:
 *  - NABL:     "2609101742-1a"    → "2609101742"
 *  - Non-NABL: "2609101742-N-2a"  → "2609101742-N"
 *  - Non-NABL: "2609101742-N-1"   → "2609101742-N"
 *  - Retest:   "2609101742-1a-v2" → "2609101742"
 *
 * The -N suffix is preserved. Dept suffixes (-1, -2), analyst suffixes
 * (-a, -b, -c) and version suffixes (-v2, -v3) are all stripped.
 *
 * @param {string} code - Raw test code
 * @returns {string} Display-safe code
 */
export const formatTestCode = (code) => {
  if (!code) return '';
  
  // Strip everything after -N if it exists
  const nonNablMatch = code.match(/^(\d+)-N(?:-.*)?$/);
  if (nonNablMatch) {
    return `${nonNablMatch[1]}-N`;
  }

  // Strip everything after the base numeric code for NABL
  const nablMatch = code.match(/^(\d+)(?:-.*)?$/);
  if (nablMatch) {
    return nablMatch[1];
  }

  return code;
};

/**
 * Format all test codes embedded within a larger message string.
 *
 * @param {string} message - Raw message containing test codes
 * @returns {string} Message with formatted test codes
 */
export const formatMessageTestCodes = (message) => {
  if (!message) return '';
  // Match any test code sequence (e.g. 2608111745-N-1a or 2608111745-1a)
  const regex = /\b(\d{8,12}(?:-[A-Za-z0-9-]+)?)\b/g;
  return message.replace(regex, (match) => formatTestCode(match));
};
