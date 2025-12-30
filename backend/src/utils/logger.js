const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * Extract caller information from stack trace
 * @param {number} skipFrames - Number of frames to skip (default: 3)
 * @returns {Object} - File name and line number
 */
const getCallerInfo = (skipFrames = 3) => {
    const originalFunc = Error.prepareStackTrace;
    let callerfile = 'unknown';
    let callerline = 0;

    try {
        const err = new Error();

        Error.prepareStackTrace = function (err, stack) {
            return stack;
        };

        const stack = err.stack;

        // Start from skipFrames to avoid our wrapper functions
        for (let i = skipFrames; i < stack.length; i++) {
            const caller = stack[i];
            const filename = caller.getFileName();

            if (!filename) continue;

            const relativePath = path.relative(process.cwd(), filename);

            // Skip files we don't want to show
            const shouldSkip =
                relativePath.includes('node_modules') ||           // Skip node_modules
                relativePath.includes('logger.js') ||              // Skip logger files
                filename.includes('winston') ||                    // Skip winston files
                filename.includes('daily-rotate-file') ||          // Skip winston transport files
                relativePath.startsWith('..') ||                   // Skip files outside project
                filename === __filename ||                         // Skip this file
                relativePath === '' ||                             // Skip empty paths
                relativePath === '.';                              // Skip current dir

            if (!shouldSkip && relativePath) {
                callerfile = filename;
                callerline = caller.getLineNumber();
                break;
            }
        }
    } catch (e) {
        // Fallback if stack trace fails
        callerfile = 'unknown';
        callerline = 0;
    }

    Error.prepareStackTrace = originalFunc;

    // Get relative path from project root
    const relativePath = callerfile !== 'unknown'
        ? path.relative(process.cwd(), callerfile)
        : 'unknown';

    return {
        file: relativePath,
        line: callerline || 0
    };
};

/**
 * Custom format that includes caller information
 */
const addCallerInfo = winston.format((info) => {
    // If caller info wasn't already added by our wrapper functions, try to get it
    if (!info.caller) {
        const caller = getCallerInfo(5); // Skip more frames since we're deeper in winston
        info.caller = `${caller.file}:${caller.line}`;
    }
    return info;
});

// Define log format with timezone and caller info
const logFormat = winston.format.combine(
    addCallerInfo(),
    winston.format.timestamp({
        format: () => {
            const now = new Date();
            const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
            const tashkentTime = new Date(utc + (5 * 3600000));
            return tashkentTime.toISOString().replace('T', ' ').replace(/\..+/, '');
        }
    }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, caller, stack, ...meta }) => {
        // Ensure proper UTF-8 handling
        const safeMessage = Buffer.isBuffer(message)
            ? message.toString('utf8')
            : String(message);

        let log = `${timestamp} [${level.toUpperCase()}] ${caller}: ${safeMessage}`;

        // Add metadata if present (exclude caller from meta)
        const cleanMeta = { ...meta };
        delete cleanMeta.caller;

        if (Object.keys(cleanMeta).length > 0) {
            // Stringify with proper UTF-8 handling
            const metaStr = JSON.stringify(cleanMeta, (key, value) => {
                if (typeof value === 'string') {
                    return value; // Keep strings as-is for proper UTF-8
                }
                return value;
            }, 2);
            log += ` | ${metaStr}`;
        }

        // Add stack trace for errors
        if (stack) {
            log += `\n${stack}`;
        }

        return log;
    })
);

// Console format for development with timezone and caller info
const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    addCallerInfo(),
    winston.format.timestamp({
        format: () => {
            const now = new Date();
            const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
            const tashkentTime = new Date(utc + (5 * 3600000));
            return tashkentTime.toLocaleString('en-GB', {
                hour12: false,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            }).replace(/(\d+)\/(\d+)\/(\d+),/, '$3-$2-$1');
        }
    }),
    winston.format.printf(({ timestamp, level, message, caller, ...meta }) => {
        // Ensure proper UTF-8 handling
        const safeMessage = Buffer.isBuffer(message)
            ? message.toString('utf8')
            : String(message);

        const shortCaller = caller ? caller.replace(/^src\//, '') : 'unknown';
        let log = `${timestamp} ${level} [${shortCaller}]: ${safeMessage}`;

        // Clean meta (exclude caller)
        const cleanMeta = { ...meta };
        delete cleanMeta.caller;

        if (Object.keys(cleanMeta).length > 0) {
            const metaStr = JSON.stringify(cleanMeta, null, 2);
            log += ` ${metaStr}`;
        }

        return log;
    })
);

// Create the logger
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
    defaultMeta: { service: 'atabai-api' },
    transports: [
        // Error logs - separate file for errors only
        new DailyRotateFile({
            filename: path.join(logsDir, 'error-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            level: 'error',
            maxSize: '100m',
            maxFiles: '5',
            zippedArchive: true,
            handleExceptions: true,
            handleRejections: true
        }),

        // HTTP logs - separate file for HTTP requests
        new DailyRotateFile({
            filename: path.join(logsDir, 'http-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            level: 'http',
            maxSize: '100m',
            maxFiles: '5',
            zippedArchive: true
        }),

        // Combined logs - all levels
        new DailyRotateFile({
            filename: path.join(logsDir, 'combined-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            maxSize: '100m',
            maxFiles: '5', // Keep 5 days worth of logs
            zippedArchive: true
        }),

        // Console output
        new winston.transports.Console({
            format: consoleFormat,
            handleExceptions: true,
            handleRejections: true,
            level: process.env.NODE_ENV === 'production' ? 'info' : 'debug'
        })
    ],

    // Don't exit on handled exceptions
    exitOnError: false
});

/**
 * Log an action in the system
 * @param {String} action - Action name (e.g., 'user_login')
 * @param {Object} details - Details of the action (userId, etc.)
 * @param {String} level - Log level (default: 'info')
 */
const logAction = (action, details = {}, level = 'info') => {
    try {
        const caller = getCallerInfo(2);
        logger.log(level, action, {
            ...details,
            caller: `${caller.file}:${caller.line}`,
            category: 'action'
        });
    } catch (error) {
        console.error(`Error logging action ${action}:`, error);
        console.log(`Fallback log - ${action}:`, details);
    }
};

/**
 * Log authentication events
 * @param {String} event - Event name (login, logout, etc.)
 * @param {Object} details - Event details
 */
const logAuth = (event, details = {}) => {
    const caller = getCallerInfo(2);
    logger.info(`AUTH: ${event}`, {
        ...details,
        caller: `${caller.file}:${caller.line}`,
        category: 'auth'
    });
};

/**
 * Log file processing events
 * @param {String} event - Event name
 * @param {Object} details - Event details
 */
const logFileProcessing = (event, details = {}) => {
    const caller = getCallerInfo(2);
    logger.info(`FILE: ${event}`, {
        ...details,
        caller: `${caller.file}:${caller.line}`,
        category: 'file-processing'
    });
};

/**
 * Log database operations
 * @param {String} operation - Operation name
 * @param {String} collection - Collection name
 * @param {Object} details - Operation details
 */
const logDatabase = (operation, collection, details = {}) => {
    const caller = getCallerInfo(2);
    logger.debug(`DB: ${operation} on ${collection}`, {
        operation,
        collection,
        ...details,
        caller: `${caller.file}:${caller.line}`,
        category: 'database'
    });
};

/**
 * Log security events
 * @param {String} event - Security event
 * @param {Object} details - Event details
 * @param {String} level - Log level (default: warn)
 */
const logSecurity = (event, details = {}, level = 'warn') => {
    const caller = getCallerInfo(2);
    logger[level](`SECURITY: ${event}`, {
        ...details,
        caller: `${caller.file}:${caller.line}`,
        category: 'security'
    });
};

/**
 * Log performance metrics
 * @param {String} metric - Metric name
 * @param {Number} value - Metric value
 * @param {String} unit - Unit of measurement
 * @param {Object} details - Additional details
 */
const logPerformance = (metric, value, unit, details = {}) => {
    const caller = getCallerInfo(2);
    logger.info(`PERF: ${metric} = ${value}${unit}`, {
        metric,
        value,
        unit,
        ...details,
        caller: `${caller.file}:${caller.line}`,
        category: 'performance'
    });
};

/**
 * Enhanced error logging with context
 * @param {String|Error} error - Error message or Error object
 * @param {Object} context - Additional context
 */
const logError = (error, context = {}) => {
    const caller = getCallerInfo(2);

    if (error instanceof Error) {
        logger.error(error.message, {
            error: {
                message: error.message,
                stack: error.stack,
                name: error.name
            },
            ...context,
            caller: `${caller.file}:${caller.line}`,
            category: 'error'
        });
    } else {
        logger.error(error.toString(), {
            ...context,
            caller: `${caller.file}:${caller.line}`,
            category: 'error'
        });
    }
};

/**
 * Log info messages
 * @param {String} message - Info message
 * @param {Object} meta - Additional metadata
 */
const logInfo = (message, meta = {}) => {
    const caller = getCallerInfo(2);
    logger.info(message, {
        ...meta,
        caller: `${caller.file}:${caller.line}`
    });
};

/**
 * Log warning messages
 * @param {String} message - Warning message
 * @param {Object} meta - Additional metadata
 */
const logWarn = (message, meta = {}) => {
    const caller = getCallerInfo(2);
    logger.warn(message, {
        ...meta,
        caller: `${caller.file}:${caller.line}`
    });
};

/**
 * Log debug messages
 * @param {String} message - Debug message
 * @param {Object} meta - Additional metadata
 */
const logDebug = (message, meta = {}) => {
    const caller = getCallerInfo(2);
    logger.debug(message, {
        ...meta,
        caller: `${caller.file}:${caller.line}`
    });
};

/**
 * HTTP request logging for Morgan
 */
const httpLogger = {
    // Stream for Morgan to write to
    stream: {
        write: (message) => {
            // Parse Morgan's combined format to extract useful info
            const parts = message.trim().split(' ');
            if (parts.length >= 7) {
                const [ip, , , timestamp, method, url, protocol, status, size, , userAgent] = parts;

                logger.http('HTTP Request', {
                    ip: ip || 'unknown',
                    method: method?.replace(/['"]/g, ''),
                    url: url?.replace(/['"]/g, ''),
                    status: status || 'unknown',
                    size: size || '-',
                    userAgent: userAgent?.replace(/['"]/g, ''),
                    caller: 'http/morgan',
                    category: 'http'
                });
            } else {
                // Fallback for simple format
                logger.http(message.trim(), {
                    caller: 'http/morgan',
                    category: 'http'
                });
            }
        }
    },

    // Custom Morgan format with colors for development
    devFormat: ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" - :response-time ms',

    // Production format without colors
    prodFormat: 'combined',

    // Log specific HTTP events
    logRequest: (req, res, responseTime) => {
        const caller = getCallerInfo(2);
        logger.http('API Request', {
            method: req.method,
            url: req.originalUrl || req.url,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            status: res.statusCode,
            responseTime: responseTime ? `${responseTime}ms` : undefined,
            userId: req.user?.id || req.user?._id,
            caller: `${caller.file}:${caller.line}`,
            category: 'api'
        });
    },

    // Log API errors
    logApiError: (req, res, error, responseTime) => {
        const caller = getCallerInfo(2);
        logger.error('API Error', {
            method: req.method,
            url: req.originalUrl || req.url,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            status: res.statusCode,
            error: error.message || error,
            responseTime: responseTime ? `${responseTime}ms` : undefined,
            userId: req.user?.id || req.user?._id,
            caller: `${caller.file}:${caller.line}`,
            category: 'api-error'
        });
    }
};

// Handle uncaught exceptions and unhandled rejections
if (process.env.NODE_ENV !== 'test') {
    process.on('uncaughtException', (error) => {
        logger.error('Uncaught Exception', {
            error: {
                message: error.message,
                stack: error.stack,
                name: error.name
            },
            category: 'system'
        });
        process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
        logger.error('Unhandled Rejection', {
            reason: reason?.message || reason,
            stack: reason?.stack,
            promise: promise.toString(),
            category: 'system'
        });
    });
}

// Log application startup
if (process.env.NODE_ENV !== 'test') {
    logger.info('Logger initialized', {
        level: logger.level,
        environment: process.env.NODE_ENV,
        logDir: logsDir,
        caller: 'logger.js',
        category: 'system'
    });
}

// Make logger available globally for convenience
global.logger = {
    ...logger,
    logAction,
    logAuth,
    logFileProcessing,
    logDatabase,
    logSecurity,
    logPerformance,
    logError,
    logInfo,
    logWarn,
    logDebug,
    http: httpLogger
};

module.exports = {
    logger,
    logAction,
    logAuth,
    logFileProcessing,
    logDatabase,
    logSecurity,
    logPerformance,
    logError,
    logInfo,
    logWarn,
    logDebug,
    http: httpLogger,

    // Legacy exports for backward compatibility
    stream: httpLogger.stream
};