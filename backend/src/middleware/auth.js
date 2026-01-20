const passport = require('passport');
const User = require('../user/model');
const authService = require('../services/auth');
const { getFileLimit } = require('../config/subscription');

/**
 * JWT Authentication Middleware
 * Validates JWT token using user's personal secret and attaches user to request
 */
const authenticateJWT = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authService.extractTokenFromHeader(authHeader);

        if (!token) {
            return res.status(401).json({
                error: 'ACCESS_TOKEN_REQUIRED',
                message: 'Access token is required'
            });
        }

        // Check if token is blacklisted
        const isBlacklisted = await authService.isTokenBlacklisted(token);
        if (isBlacklisted) {
            return res.status(401).json({
                error: 'TOKEN_REVOKED',
                message: 'Token has been revoked'
            });
        }

        // STEP 1: Decode token without verification to get userId
        const decoded = authService.decodeToken(token);
        if (!decoded || !decoded.userId) {
            return res.status(401).json({
                error: 'INVALID_TOKEN',
                message: 'Invalid token format'
            });
        }

        // STEP 2: Find user with their secret
        const user = await User.findById(decoded.userId)
            .select('+refreshTokenSecret +refreshTokenSecretCreatedAt');

        if (!user || !user.isActive) {
            return res.status(401).json({
                error: 'USER_NOT_FOUND',
                message: 'User not found or inactive'
            });
        }

        // STEP 3: Verify token with user's personal secret
        try {
            await authService.verifyAccessToken(token, user);
        } catch (verifyError) {
            // Token verification failed - could be expired or invalid
            if (verifyError.message === 'ACCESS_TOKEN_EXPIRED') {
                return res.status(401).json({
                    error: 'ACCESS_TOKEN_EXPIRED',
                    message: 'Access token has expired'
                });
            }

            if (verifyError.message === 'INVALID_ACCESS_TOKEN') {
                return res.status(401).json({
                    error: 'INVALID_ACCESS_TOKEN',
                    message: 'Invalid access token'
                });
            }

            throw verifyError;
        }

        // Reset monthly counter if needed
        await user.resetMonthlyCounterIfNeeded();

        // Attach user to request
        req.user = user;
        req.token = token;

        next();
    } catch (error) {
        global.logger.logWarn(`JWT authentication failed: ${error.message}`);

        return res.status(401).json({
            error: 'AUTHENTICATION_FAILED',
            message: 'Authentication failed'
        });
    }
};

/**
 * Optional JWT Authentication Middleware
 * Attaches user to request if token is valid, but doesn't fail if no token
 */
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authService.extractTokenFromHeader(authHeader);

        if (!token) {
            return next(); // No token provided, continue without user
        }

        // Check if token is blacklisted
        const isBlacklisted = await authService.isTokenBlacklisted(token);
        if (isBlacklisted) {
            return next(); // Token revoked, continue without user
        }

        // Decode token to get userId
        const decoded = authService.decodeToken(token);
        if (!decoded || !decoded.userId) {
            return next(); // Invalid token format, continue without user
        }

        // Find user with their secret
        const user = await User.findById(decoded.userId)
            .select('+refreshTokenSecret +refreshTokenSecretCreatedAt');

        if (!user || !user.isActive) {
            return next(); // User not found, continue without user
        }

        // Verify token with user's personal secret
        try {
            await authService.verifyAccessToken(token, user);
            await user.resetMonthlyCounterIfNeeded();
            req.user = user;
            req.token = token;
        } catch (error) {
            // Verification failed, continue without user
            global.logger.logDebug(`Optional auth verification failed: ${error.message}`);
        }

        next();
    } catch (error) {
        // Authentication failed, but continue without user
        global.logger.logDebug(`Optional authentication failed: ${error.message}`);
        next();
    }
};

/**
 * Subscription check middleware
 * Ensures user has required subscription level
 */
const requireSubscription = (requiredType = 'premium') => {
    return async (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'AUTHENTICATION_REQUIRED',
                message: 'Authentication required'
            });
        }

        const user = req.user;

        // Check if user has required subscription
        if (requiredType === 'premium' && user.subscriptionType !== 'premium') {
            return res.status(403).json({
                error: 'PREMIUM_REQUIRED',
                message: 'Premium subscription required for this feature'
            });
        }

        // Check if premium subscription is active
        if (user.subscriptionType === 'premium') {
            if (!user.subscriptionExpiresAt || user.subscriptionExpiresAt < new Date()) {
                return res.status(403).json({
                    error: 'SUBSCRIPTION_EXPIRED',
                    message: 'Your premium subscription has expired'
                });
            }
        }

        next();
    };
};

/**
 * File processing limit check middleware
 * Checks if user can process files based on their monthly limit
 */
const checkFileProcessingLimit = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                error: 'AUTHENTICATION_REQUIRED',
                message: 'Authentication required'
            });
        }

        const user = req.user;
        const canProcess = await user.canProcessFiles();

        if (!canProcess) {
            const limit = await getFileLimit(user.subscriptionType);
            return res.status(403).json({
                error: 'MONTHLY_LIMIT_REACHED',
                message: 'Monthly file processing limit reached',
                limit: limit,
                processed: user.filesProcessedThisMonth,
                resetDate: user.monthlyResetDate
            });
        }

        next();
    } catch (error) {
        global.logger.logError('Error checking file processing limit:', error);
        res.status(500).json({
            error: 'LIMIT_CHECK_FAILED',
            message: 'Failed to check processing limit'
        });
    }
};

/**
 * Admin check middleware
 * Ensures user has admin privileges
 */
const requireAdmin = async (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            error: 'AUTHENTICATION_REQUIRED',
            message: 'Authentication required'
        });
    }

    // TODO: Implement admin role check when user roles are added
    // For now, check if user email is in admin list
    const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(email => email.trim());

    if (!adminEmails.includes(req.user.email)) {
        return res.status(403).json({
            error: 'ADMIN_REQUIRED',
            message: 'Admin privileges required'
        });
    }

    next();
};

/**
 * Passport Google OAuth middleware wrapper
 */
const authenticateGoogle = passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false
});

/**
 * Passport Google OAuth callback middleware wrapper
 */
const authenticateGoogleCallback = (req, res, next) => {
    passport.authenticate('google', {
        session: false,
        failureRedirect: `${process.env.FRONTEND_URL || 'http://localhost:8080'}/login?error=oauth_failed`
    })(req, res, next);
};

/**
 * Rate limiting for auth endpoints
 */
const authRateLimit = {
    login: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 10, // 10 login attempts per window
        message: {
            error: 'TOO_MANY_LOGIN_ATTEMPTS',
            message: 'Too many login attempts, please try again later'
        }
    },
    refresh: {
        windowMs: 60 * 1000, // 1 minute
        max: 10, // 10 refresh attempts per minute
        message: {
            error: 'TOO_MANY_REFRESH_ATTEMPTS',
            message: 'Too many token refresh attempts, please try again later'
        }
    }
};

module.exports = {
    authenticateJWT,
    optionalAuth,
    requireSubscription,
    checkFileProcessingLimit,
    requireAdmin,
    authenticateGoogle,
    authenticateGoogleCallback,
    authRateLimit
};