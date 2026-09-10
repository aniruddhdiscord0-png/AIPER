/**
 * dateUtils.js
 * Centralised date/time formatting for the AIPER frontend.
 * All dates must display as DD/MM/YYYY with zero-padded single digits.
 * All timestamps must display as DD/MM/YYYY, HH:MM.
 */

/**
 * Format a date value as DD/MM/YYYY.
 * @param {string|Date} d - ISO string, date string, or Date object
 * @returns {string} e.g. "01/09/2026"
 */
export const formatDate = (d) => {
  if (!d) return '';
  const date = new Date(d);
  if (isNaN(date)) return '';
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

/**
 * Format a date-time value as DD/MM/YYYY, HH:MM.
 * @param {string|Date} d - ISO string, date string, or Date object
 * @returns {string} e.g. "01/09/2026, 14:05"
 */
export const formatDateTime = (d) => {
  if (!d) return '';
  const date = new Date(d);
  if (isNaN(date)) return '';
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy}, ${hh}:${min}`;
};
