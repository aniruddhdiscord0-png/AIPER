const { logAudit } = require('./logger');

// Fields that should never appear in log diffs
const SENSITIVE_FIELDS = /password|token|otp|secret|authorization/i;

/**
 * Compute a diff between two plain objects.
 * Returns an object of { fieldPath: { before, after } } for changed fields.
 * Only includes fields that actually changed.
 * 
 * @param {Object} before - Document state before the mutation
 * @param {Object} after - Document state after the mutation
 * @param {string[]} fields - Specific fields to compare (dot-notation supported).
 *                            If empty, compares all top-level keys from `before`.
 * @returns {Object|null} Diff object or null if nothing changed
 */
function computeDiff(before, after, fields = []) {
  if (!before || !after) return null;

  const diff = {};
  const keysToCheck = fields.length > 0 ? fields : Object.keys(before);

  for (const key of keysToCheck) {
    if (SENSITIVE_FIELDS.test(key)) continue;

    const beforeVal = getNestedValue(before, key);
    const afterVal = getNestedValue(after, key);

    // Deep comparison via JSON (handles nested objects)
    const beforeStr = JSON.stringify(beforeVal ?? null);
    const afterStr = JSON.stringify(afterVal ?? null);

    if (beforeStr !== afterStr) {
      diff[key] = {
        before: sanitizeValue(beforeVal),
        after: sanitizeValue(afterVal)
      };
    }
  }

  return Object.keys(diff).length > 0 ? diff : null;
}

/**
 * Get a nested value from an object using dot notation.
 * e.g., getNestedValue(obj, 'sample.nabl_type')
 */
function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

/**
 * Sanitize a value for safe logging.
 * Truncates very long strings to prevent log bloat.
 */
function sanitizeValue(val) {
  if (val === undefined) return undefined;
  if (val === null) return null;
  if (typeof val === 'string' && val.length > 500) {
    return val.substring(0, 500) + '... [truncated]';
  }
  if (Array.isArray(val) && val.length > 20) {
    return `[Array: ${val.length} items]`;
  }
  return val;
}

/**
 * Extract user info from the Express request for logging.
 */
function extractUser(req) {
  if (!req?.user) return undefined;
  return {
    id: req.user._id,
    name: req.user.name,
    role: req.user.role
  };
}

/**
 * Log a business audit event.
 * 
 * @param {string} event - Event name (e.g., 'JOB_CREATED', 'TEST_REVIEWED')
 * @param {Object} options
 * @param {Object} options.req - Express request object (for user extraction)
 * @param {Object} options.user - Explicit user object { id, name, role }
 * @param {string} options.message - Human-readable description
 * @param {Object} options.target - { model, documentId, identifier }
 * @param {Object} options.diff - Pre-computed diff or null
 * @param {Object} options.before - Document snapshot before mutation (will compute diff with after)
 * @param {Object} options.after - Document snapshot after mutation
 * @param {string[]} options.fields - Fields to compare for diff computation
 */
function audit(event, options = {}) {
  const { req, user, message, target, diff, before, after, fields } = options;

  // Compute diff if before/after provided but no explicit diff
  let finalDiff = diff || null;
  if (!finalDiff && before && after) {
    finalDiff = computeDiff(
      typeof before.toObject === 'function' ? before.toObject() : before,
      typeof after.toObject === 'function' ? after.toObject() : after,
      fields || []
    );
  }

  logAudit(event, {
    message: message || event,
    user: user || extractUser(req),
    target,
    diff: finalDiff,
    request: req ? {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip || req.headers?.['x-forwarded-for'],
      userAgent: req.headers?.['user-agent'],
      statusCode: req.res?.statusCode
    } : undefined
  });
}

module.exports = {
  audit,
  computeDiff,
  extractUser
};
