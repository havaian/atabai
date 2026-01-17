const passport = require('passport');
const User = require('../user/model');
const authService = require('../services/auth');
const { getFileLimit } = require('../config/subscription');

/**
 * JWT Authentication Middleware
 * Validates JWT token and attaches user to request
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

        // Verify token
        const decoded = await authService.verifyAccessToken(token);

        // Find user
        const user = await User.findById(decoded.userId);
        if (!user || !user.isActive) {
            return res.status(401).json({
                error: 'USER_NOT_FOUND',
                message: 'User not found or inactive'
            });
        }

        // Reset monthly counter if needed
        await user.resetMonthlyCounterIfNeeded();

        // Attach user to request
        req.user = user;
        req.token = token;

        next();
    } catch (error) {
        global.logger.logWarn(`JWT authentication failed: ${error.message}`);

        if (error.message === 'ACCESS_TOKEN_EXPIRED') {
            return res.status(401).json({
                error: 'ACCESS_TOKEN_EXPIRED',
                message: 'Access token has expired'
            });
        }

        if (error.message === 'INVALID_ACCESS_TOKEN') {
            return res.status(401).json({
                error: 'INVALID_ACCESS_TOKEN',
                message: 'Invalid access token'
            });
        }

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

        // Verify token
        const decoded = await authService.verifyAccessToken(token);

        // Find user
        const user = await User.findById(decoded.userId);
        if (user && user.isActive) {
            await user.resetMonthlyCounterIfNeeded();
            req.user = user;
            req.token = token;
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
const requireSubscription = (requiredLevel = 'basic') => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'AUTHENTICATION_REQUIRED',
                message: 'Authentication required'
            });
        }

        const userLevel = req.user.subscriptionType;
        const levels = { basic: 1, premium: 2 };

        if (levels[userLevel] < levels[requiredLevel]) {
            return res.status(403).json({
                error: 'INSUFFICIENT_SUBSCRIPTION',
                message: `${requiredLevel} subscription required`,
                userSubscription: userLevel,
                requiredSubscription: requiredLevel
            });
        }

        next();
    };
};

/**
 * File processing limit check middleware
 * Ensures user hasn't exceeded monthly processing limit
 */
const checkFileProcessingLimit = async (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            error: 'AUTHENTICATION_REQUIRED',
            message: 'Authentication required'
        });
    }

    if (!req.user.canProcessFiles()) {
        const limit = await getFileLimit(req.user.subscriptionType);

        return res.status(403).json({
            error: 'PROCESSING_LIMIT_EXCEEDED',
            message: 'Monthly file processing limit exceeded',
            currentCount: req.user.filesProcessedThisMonth,
            limit,
            subscriptionType: req.user.subscriptionType
        });
    }

    next();
};

/**
 * Admin check middleware (for future use)
 * Ensures user has admin privileges
 */
const requireAdmin = (req, res, next) => {
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