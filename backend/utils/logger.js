const winston = require('winston');

/**
 * Central logger for the AIPER application.
 * 
 * Transports:
 *  - Console: all levels in dev, warn+ in production
 *  - MongoDB: mutations (audit) + errors + warnings (persisted for export)
 */

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const LOG_DB_ENABLED = process.env.LOG_DB_ENABLED !== 'false'; // default true
const MONGODB_URI = process.env.MONGODB_URI;

// Custom format for console output
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, event, msg, user, request }) => {
    const levelUp = level.toUpperCase();
    const icon = levelUp === 'ERROR' ? 'X' : levelUp === 'WARN' ? '!' : '->';
    const userStr = user?.name ? ` [${user.name}]` : '';
    const statusStr = request?.statusCode ? ` ${request.statusCode}` : '';
    const timeStr = request?.responseTimeMs ? ` ${request.responseTimeMs}ms` : '';
    const brief = timeStr ? `${statusStr} ${timeStr}` : statusStr;
    return `${timestamp} ${icon} ${event || levelUp}${userStr} ${msg || ''}${brief ? ` (${brief.trim()})` : ''}`;
  })
);

// Build transports array
const transports = [
  new winston.transports.Console({
    level: process.env.NODE_ENV === 'production' ? 'warn' : 'audit',
    format: consoleFormat
  })
];



const logger = winston.createLogger({
  level: LOG_LEVEL,
  levels: {
    error: 0,
    warn: 1,
    audit: 2,
    info: 3,
    debug: 4
  },
  transports,
  // Don't crash on logging failures
  exitOnError: false
});

// Add colors for custom levels
winston.addColors({
  error: 'red',
  warn: 'yellow',
  audit: 'cyan',
  info: 'green',
  debug: 'gray'
});

/**
 * Initialize logging confirmation once the DB connection is ready.
 * Called from server.js after mongoose.connect() succeeds.
 * Note: Persistence is handled via direct SystemLog.create() in log(),
 * not via winston-mongodb transport, to ensure schema consistency.
 */
function initMongoTransport() {
  if (!LOG_DB_ENABLED || !MONGODB_URI) return;
  console.log('[Logger] MongoDB logging enabled (direct writes to SystemLog collection)');
}

/**
 * Structured log helper — writes a log entry matching the SystemLog schema.
 * This is the primary interface for all logging in the app.
 * 
 * For audit/warn/error: persisted to MongoDB (queryable + exportable)
 * For info: console only (unless LOG_GET_TO_DB=true)
 */
function log(level, event, data = {}) {
  const entry = {
    level,
    event,
    message: data.message || event,
    // Metadata stored under 'meta' key for winston-mongodb
    user: data.user || undefined,
    target: data.target || undefined,
    diff: data.diff || undefined,
    request: data.request || undefined,
    error: data.error || undefined,
    source: data.source || 'server'
  };

  // Persist audit/warn/error directly to SystemLog for reliable schema-matched writes
  if (['audit', 'error', 'warn'].includes(level) && LOG_DB_ENABLED) {
    const SystemLog = require('../models/SystemLog');
    SystemLog.create({
      level,
      event,
      message: entry.message,
      user: entry.user,
      target: entry.target,
      diff: entry.diff,
      request: entry.request,
      error: entry.error,
      source: entry.source,
      timestamp: new Date()
    }).catch(err => {
      // Fire-and-forget — never let logging break the app
      console.error('[Logger] Failed to persist log:', err.message);
    });
  }

  // Write to console via winston (only audit+ levels will show due to transport config)
  // Use 'msg' key to avoid winston's built-in 'message' merging behavior
  logger.log(level, '', { ...entry, msg: entry.message });
}

// Convenience methods
const logInfo = (event, data) => log('info', event, data);
const logAudit = (event, data) => log('audit', event, data);
const logWarn = (event, data) => log('warn', event, data);
const logError = (event, data) => log('error', event, data);

module.exports = {
  logger,
  initMongoTransport,
  log,
  logInfo,
  logAudit,
  logWarn,
  logError
};
