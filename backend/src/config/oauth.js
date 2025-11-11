const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const User = require('../models/User');

// Validate required environment variables
const requiredEnvVars = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'JWT_SECRET'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
    global.logger.logError(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
    throw new Error(`OAuth configuration error: Missing environment variables`);
}

// Google OAuth Strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/api/auth/google/callback", // This is correct now
    scope: ['profile', 'email']
}, async (accessToken, refreshToken, profile, done) => {
    try {
        global.logger.logInfo(`Google OAuth callback for user: ${profile.emails?.[0]?.value}`);

        // Find or create user from Google profile
        const user = await User.findOrCreateFromGoogle(profile);

        global.logger.logInfo(`User authenticated: ${user.email}`);
        return done(null, user);
    } catch (error) {
        global.logger.logError('Google OAuth error:', error);
        return done(error, null);
    }
}));

// JWT Strategy for API authentication
passport.use(new JwtStrategy({
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: process.env.JWT_SECRET,
    jsonWebTokenOptions: {
        ignoreExpiration: false
    }
}, async (payload, done) => {
    try {
        // Find user by ID from JWT payload
        const user = await User.findById(payload.userId);

        if (!user || !user.isActive) {
            global.logger.logWarn(`JWT authentication failed - user not found or inactive: ${payload.userId}`);
            return done(null, false);
        }

        // Reset monthly counter if needed
        await user.resetMonthlyCounterIfNeeded();

        global.logger.logDebug(`JWT authentication successful for user: ${user.email}`);
        return done(null, user);
    } catch (error) {
        global.logger.logError('JWT authentication error:', error);
        return done(error, false);
    }
}));

// Serialize user for session (minimal implementation, we use JWT)
passport.serializeUser((user, done) => {
    done(null, user._id);
});

// Deserialize user from session (minimal implementation, we use JWT)
passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (error) {
        done(error, null);
    }
});

// OAuth configuration constants
const OAUTH_CONFIG = {
    GOOGLE_SCOPE: ['profile', 'email'],
    SESSION_MAX_AGE: 24 * 60 * 60 * 1000, // 24 hours
    CALLBACK_SUCCESS_REDIRECT: `${process.env.FRONTEND_URL || 'http://localhost:8080'}/auth/success`,
    CALLBACK_FAILURE_REDIRECT: `${process.env.FRONTEND_URL || 'http://localhost:8080'}/login?error=oauth_failed`
};

module.exports = {
    passport,
    OAUTH_CONFIG
};