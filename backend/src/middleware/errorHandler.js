/**
 * Error handling middleware
 * Must be the last middleware in the chain
 */
const errorHandler = (err, req, res, next) => {
    let error = { ...err };
    error.message = err.message;

    // Log error with context
    global.logger.logError('Error occurred', err, {
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        userId: req.user?._id,
        body: req.method !== 'GET' ? req.body : undefined
    });

    // Mongoose bad ObjectId
    if (err.name === 'CastError') {
        const message = 'Resource not found';
        error = {
            statusCode: 404,
            error: 'RESOURCE_NOT_FOUND',
            message
        };
    }

    // Mongoose duplicate key error
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue)[0];
        const message = `${field} already exists`;
        error = {
            statusCode: 400,
            error: 'DUPLICATE_FIELD',
            message,
            field
        };
    }

    // Mongoose validation error
    if (err.name === 'ValidationError') {
        const message = Object.values(err.errors).map(error => error.message).join(', ');
        error = {
            statusCode: 400,
            error: 'VALIDATION_ERROR',
            message,
            details: Object.values(err.errors).map(error => ({
                field: error.path,
                message: error.message,
                value: error.value
            }))
        };
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        error = {
            statusCode: 401,
            error: 'INVALID_TOKEN',
            message: 'Invalid token'
        };
    }

    if (err.name === 'TokenExpiredError') {
        error = {
            statusCode: 401,
            error: 'TOKEN_EXPIRED',
            message: 'Token expired'
        };
    }

    // MongoDB connection errors
    if (err.name === 'MongoError' || err.name === 'MongoServerError') {
        error = {
            statusCode: 500,
            error: 'DATABASE_ERROR',
            message: 'Database operation failed'
        };
    }

    // File upload errors (Multer)
    if (err.code === 'LIMIT_FILE_SIZE') {
        error = {
            statusCode: 400,
            error: 'FILE_TOO_LARGE',
            message: 'File size exceeds limit'
        };
    }

    if (err.code === 'LIMIT_FILE_COUNT') {
        error = {
            statusCode: 400,
            error: 'TOO_MANY_FILES',
            message: 'Too many files uploaded'
        };
    }

    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        error = {
            statusCode: 400,
            error: 'UNEXPECTED_FILE',
            message: 'Unexpected file field'
        };
    }

    // Express validator errors
    if (err.type === 'entity.parse.failed') {
        error = {
            statusCode: 400,
            error: 'INVALID_JSON',
            message: 'Invalid JSON in request body'
        };
    }

    if (err.type === 'entity.too.large') {
        error = {
            statusCode: 413,
            error: 'PAYLOAD_TOO_LARGE',
            message: 'Request payload too large'
        };
    }

    // Custom application errors
    if (err.isOperational) {
        error = {
            statusCode: err.statusCode || 500,
            error: err.error || 'APPLICATION_ERROR',
            message: err.message,
            details: err.details
        };
    }

    // Default to 500 server error
    const statusCode = error.statusCode || 500;
    const errorCode = error.error || 'INTERNAL_SERVER_ERROR';
    const message = error.message || 'Internal server error';

    // Send error response
    res.status(statusCode).json({
        success: false,
        error: errorCode,
        message,
        ...(error.details && { details: error.details }),
        ...(error.field && { field: error.field }),

        // Include stack trace in development
        ...(process.env.NODE_ENV === 'development' && {
            stack: err.stack
        }),

        // Include request ID if available
        ...(req.requestId && { requestId: req.requestId })
    });
};

/**
 * Custom error class for application errors
 */
class AppError extends Error {
    constructor(message, statusCode = 500, errorCode = 'APPLICATION_ERROR', details = null) {
        super(message);

        this.statusCode = statusCode;
        this.error = errorCode;
        this.details = details;
        this.isOperational = true;

        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Async error handler wrapper
 * Wraps async functions to catch errors and pass to error handler
 */
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * 404 Not Found middleware
 */
const notFound = (req, res, next) => {
    const error = new AppError(
        `Route ${req.method} ${req.originalUrl} not found`,
        404,
        'ROUTE_NOT_FOUND'
    );
    next(error);
};

module.exports = {
    errorHandler,
    AppError,
    asyncHandler,
    notFound
};