const express = require('express');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const authController = require('./controller');
const {
    authenticateJWT,
    authenticateGoogle,
    authenticateGoogleCallback,
    authRateLimit
} = require('../middleware/auth');

const router = express.Router();

// Rate limiters for auth endpoints
const loginLimiter = rateLimit(authRateLimit.login);
const refreshLimiter = rateLimit(authRateLimit.refresh);

// Validation middleware
const validateRefreshToken = [
    body('refreshToken')
        .notEmpty()
        .withMessage('Refresh token is required')
        .isLength({ min: 10 })
        .withMessage('Invalid refresh token format'),
];

const validateGoogleCallback = [
    body('code')
        .notEmpty()
        .withMessage('OAuth authorization code is required')
        .isLength({ min: 10 })
        .withMessage('Invalid authorization code format'),
];

const validateProfileUpdate = [
    body('name')
        .optional()
        .trim()
        .isLength({ min: 1, max: 100 })
        .withMessage('Name must be between 1 and 100 characters'),
    body('preferences.language')
        .optional()
        .isIn(['ru', 'uz', 'en'])
        .withMessage('Language must be ru, uz, or en'),
    body('preferences.notifications.email')
        .optional()
        .isBoolean()
        .withMessage('Email notification preference must be boolean'),
    body('preferences.notifications.browser')
        .optional()
        .isBoolean()
        .withMessage('Browser notification preference must be boolean'),
];

// Middleware to handle validation errors
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            error: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: errors.array()
        });
    }
    next();
};

/**
 * @route   GET /api/auth/google
 * @desc    Initiate Google OAuth login
 * @access  Public
 */
router.get('/google', loginLimiter, authController.initiateGoogleLogin);

/**
 * @route   POST /api/auth/google/callback
 * @desc    Handle Google OAuth callback
 * @access  Public
 */
router.post('/google/callback',
    loginLimiter,
    validateGoogleCallback,
    handleValidationErrors,
    authController.handleGoogleCallback
);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token
 * @access  Public
 */
router.post('/refresh',
    refreshLimiter,
    validateRefreshToken,
    handleValidationErrors,
    authController.refreshToken
);

/**
 * @route   GET /api/auth/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/profile', authenticateJWT, authController.getProfile);

/**
 * @route   PUT /api/auth/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put('/profile',
    authenticateJWT,
    validateProfileUpdate,
    handleValidationErrors,
    authController.updateProfile
);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user and revoke token
 * @access  Private
 */
router.post('/logout', authenticateJWT, authController.logout);

/**
 * @route   GET /api/auth/health
 * @desc    Health check for auth service
 * @access  Public
 */
router.get('/health', authController.healthCheck);

module.exports = router;