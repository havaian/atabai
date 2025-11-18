const { body, param, query, validationResult } = require('express-validator');
const path = require('path');

/**
 * Validation for file upload
 */
const validateFileUpload = [
    body('template')
        .notEmpty()
        .withMessage('Template type is required')
        .isIn(['depreciation', 'discounts', 'impairment', 'reports'])
        .withMessage('Invalid template type'),

    // Custom validation for uploaded file
    (req, res, next) => {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'VALIDATION_ERROR',
                message: 'No file uploaded'
            });
        }

        // Validate file extension
        const allowedExtensions = ['.xlsx', '.xls'];
        const fileExtension = path.extname(req.file.originalname).toLowerCase();

        if (!allowedExtensions.includes(fileExtension)) {
            return res.status(400).json({
                success: false,
                error: 'INVALID_FILE_TYPE',
                message: 'Only Excel files (.xlsx, .xls) are allowed'
            });
        }

        // Validate file size (10MB max)
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (req.file.size > maxSize) {
            return res.status(400).json({
                success: false,
                error: 'FILE_TOO_LARGE',
                message: 'File size must be less than 10MB'
            });
        }

        // Validate MIME type
        const allowedMimeTypes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel',
            'application/octet-stream'
        ];

        if (!allowedMimeTypes.includes(req.file.mimetype)) {
            return res.status(400).json({
                success: false,
                error: 'INVALID_MIME_TYPE',
                message: 'Invalid file format'
            });
        }

        next();
    }
];

/**
 * Validation for Google OAuth callback
 */
const validateGoogleCallback = [
    body('code')
        .notEmpty()
        .withMessage('Authorization code is required')
        .isLength({ min: 10 })
        .withMessage('Invalid authorization code format')
];

/**
 * Validation for token refresh
 */
const validateRefreshToken = [
    body('refreshToken')
        .notEmpty()
        .withMessage('Refresh token is required')
        .isJWT()
        .withMessage('Invalid refresh token format')
];

/**
 * Validation for profile update
 */
const validateProfileUpdate = [
    body('name')
        .optional()
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('Name must be between 2 and 100 characters'),

    body('preferences.language')
        .optional()
        .isIn(['en', 'ru', 'uz'])
        .withMessage('Language must be one of: en, ru, uz'),

    body('preferences.defaultTemplate')
        .optional()
        .isIn(['depreciation', 'discounts', 'impairment', 'reports'])
        .withMessage('Invalid default template'),

    body('preferences.notifications.email')
        .optional()
        .isBoolean()
        .withMessage('Email notification preference must be boolean'),

    body('preferences.notifications.browser')
        .optional()
        .isBoolean()
        .withMessage('Browser notification preference must be boolean')
];

/**
 * Validation for file operations
 */
const validateFileId = [
    param('fileId')
        .isMongoId()
        .withMessage('Invalid file ID format')
];

const validateJobId = [
    param('jobId')
        .isUUID()
        .withMessage('Invalid job ID format')
];

/**
 * Validation for file history query
 */
const validateFileHistoryQuery = [
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100'),

    query('offset')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Offset must be a non-negative integer'),

    query('status')
        .optional()
        .isIn(['uploaded', 'processing', 'completed', 'failed'])
        .withMessage('Invalid status filter'),

    query('templateType')
        .optional()
        .isIn(['depreciation', 'discounts', 'impairment', 'reports'])
        .withMessage('Invalid template type filter')
];

/**
 * Validation for template operations
 */
const validateTemplateId = [
    param('templateId')
        .isIn(['depreciation', 'discounts', 'impairment', 'reports'])
        .withMessage('Invalid template ID')
];

const validateTemplateValidation = [
    body('data')
        .isObject()
        .withMessage('Template data must be an object'),

    body('data.*.assetName')
        .optional()
        .trim()
        .isLength({ min: 1, max: 255 })
        .withMessage('Asset name must be between 1 and 255 characters'),

    body('data.*.cost')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Cost must be a positive number'),

    body('data.*.usefulLife')
        .optional()
        .isFloat({ min: 0.1, max: 100 })
        .withMessage('Useful life must be between 0.1 and 100 years')
];

/**
 * Rate limiting validation
 */
const validateRateLimit = (req, res, next) => {
    // Check if user has exceeded daily limits
    if (req.user && req.user.subscriptionType === 'basic') {
        const dailyLimit = 20; // API calls per day for basic users

        // In production, this would check against Redis or database
        // For now, just proceed
        next();
    } else {
        next();
    }
};

/**
 * Validation for search queries
 */
const validateSearchQuery = [
    query('q')
        .optional()
        .trim()
        .isLength({ min: 1, max: 100 })
        .withMessage('Search query must be between 1 and 100 characters'),

    query('type')
        .optional()
        .isIn(['files', 'templates', 'jobs'])
        .withMessage('Invalid search type')
];

/**
 * Validation for pagination
 */
const validatePagination = [
    query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page must be a positive integer'),

    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100')
];

/**
 * Validation for date ranges
 */
const validateDateRange = [
    query('startDate')
        .optional()
        .isISO8601()
        .withMessage('Start date must be in ISO 8601 format'),

    query('endDate')
        .optional()
        .isISO8601()
        .withMessage('End date must be in ISO 8601 format'),

    // Custom validation to ensure endDate is after startDate
    (req, res, next) => {
        const { startDate, endDate } = req.query;

        if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);

            if (start >= end) {
                return res.status(400).json({
                    success: false,
                    error: 'INVALID_DATE_RANGE',
                    message: 'End date must be after start date'
                });
            }
        }

        next();
    }
];

/**
 * Validation for subscription operations
 */
const validateSubscriptionUpdate = [
    body('subscriptionType')
        .isIn(['basic', 'premium', 'enterprise'])
        .withMessage('Invalid subscription type'),

    body('billingCycle')
        .optional()
        .isIn(['monthly', 'yearly'])
        .withMessage('Billing cycle must be monthly or yearly'),

    body('autoRenew')
        .optional()
        .isBoolean()
        .withMessage('Auto renew must be boolean')
];

/**
 * Common validation for MongoDB ObjectId
 */
const validateObjectId = (fieldName) => [
    param(fieldName)
        .isMongoId()
        .withMessage(`Invalid ${fieldName} format`)
];

/**
 * Validation for bulk operations
 */
const validateBulkOperation = [
    body('fileIds')
        .isArray({ min: 1, max: 50 })
        .withMessage('File IDs must be an array with 1-50 items'),

    body('fileIds.*')
        .isMongoId()
        .withMessage('Each file ID must be a valid MongoDB ObjectId'),

    body('operation')
        .isIn(['delete', 'retry', 'export'])
        .withMessage('Invalid bulk operation')
];

/**
 * Security validation
 */
const validateSecurityHeaders = (req, res, next) => {
    // Check for suspicious patterns in request
    const suspiciousPatterns = [
        /<script/i,
        /javascript:/i,
        /on\w+\s*=/i,
        /eval\(/i
    ];

    const requestBody = JSON.stringify(req.body || {});
    const hasSecurityIssue = suspiciousPatterns.some(pattern =>
        pattern.test(requestBody)
    );

    if (hasSecurityIssue) {
        global.logger.logWarn(`Security validation failed for request from ${req.ip}`);
        return res.status(400).json({
            success: false,
            error: 'SECURITY_VIOLATION',
            message: 'Request contains potentially malicious content'
        });
    }

    next();
};

module.exports = {
    validateFileUpload,
    validateGoogleCallback,
    validateRefreshToken,
    validateProfileUpdate,
    validateFileId,
    validateJobId,
    validateFileHistoryQuery,
    validateTemplateId,
    validateTemplateValidation,
    validateRateLimit,
    validateSearchQuery,
    validatePagination,
    validateDateRange,
    validateSubscriptionUpdate,
    validateObjectId,
    validateBulkOperation,
    validateSecurityHeaders
};