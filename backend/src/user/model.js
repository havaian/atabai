const mongoose = require('mongoose');
const crypto = require('crypto');
const { getFileLimit } = require('../config/subscription');

const userSchema = new mongoose.Schema({
    googleId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        index: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    picture: {
        type: String,
        default: null
    },
    subscriptionType: {
        type: String,
        enum: ['basic', 'premium'],
        default: 'basic'
    },
    subscriptionExpiresAt: {
        type: Date,
        default: null
    },
    filesProcessedThisMonth: {
        type: Number,
        default: 0,
        min: 0
    },
    monthlyResetDate: {
        type: Date,
        default: () => new Date()
    },
    isActive: {
        type: Boolean,
        default: true
    },
    preferences: {
        language: {
            type: String,
            enum: ['ru', 'uz', 'en'],
            default: 'ru'
        },
        theme: {
            type: String,
            enum: ['light', 'dark', 'system'],
            default: 'system'
        },
        defaultTemplate: {
            type: String,
            default: null
        },
        notifications: {
            email: {
                type: Boolean,
                default: true
            },
            browser: {
                type: Boolean,
                default: true
            }
        }
    },
    lastLoginAt: {
        type: Date,
        default: Date.now
    },
    // Per-user JWT secret for token signing/verification
    refreshTokenSecret: {
        type: String,
        required: false,
        select: false // Don't include in queries by default for security
    },
    refreshTokenSecretCreatedAt: {
        type: Date,
        required: false
    }
}, {
    timestamps: true,
    toJSON: {
        transform: function (doc, ret) {
            // Remove sensitive fields from JSON output
            delete ret.__v;
            delete ret.refreshTokenSecret; // Never expose secret
            delete ret.refreshTokenSecretCreatedAt;
            return ret;
        }
    }
});

// Index for efficient queries
userSchema.index({ email: 1, isActive: 1 });
userSchema.index({ subscriptionType: 1, isActive: 1 });

// Virtual for checking if subscription is active
userSchema.virtual('isSubscriptionActive').get(function () {
    if (this.subscriptionType === 'basic') return true;
    if (!this.subscriptionExpiresAt) return false;
    return this.subscriptionExpiresAt > new Date();
});

// Method to check if user can process files
userSchema.methods.canProcessFiles = async function () {
    const limit = await getFileLimit(this.subscriptionType);
    return this.filesProcessedThisMonth < limit && this.isActive;
};

// Method to increment processed files counter
userSchema.methods.incrementProcessedFiles = function () {
    this.filesProcessedThisMonth += 1;
    return this.save();
};

// Method to reset monthly counter if needed
userSchema.methods.resetMonthlyCounterIfNeeded = function () {
    const now = new Date();
    const resetDate = new Date(this.monthlyResetDate);

    // If more than a month has passed, reset counter
    if (now.getTime() - resetDate.getTime() > 30 * 24 * 60 * 60 * 1000) {
        this.filesProcessedThisMonth = 0;
        this.monthlyResetDate = now;
        return this.save();
    }

    return Promise.resolve(this);
};

// Method to update last login
userSchema.methods.updateLastLogin = function () {
    this.lastLoginAt = new Date();
    return this.save();
};

/**
 * Generate a secure random secret for JWT signing
 * @returns {string} 64-character hex string
 */
userSchema.methods.generateRefreshTokenSecret = function () {
    return crypto.randomBytes(32).toString('hex');
};

/**
 * Check if refresh token secret needs regeneration (older than 30 days)
 * @returns {boolean}
 */
userSchema.methods.needsSecretRegeneration = function () {
    if (!this.refreshTokenSecret || !this.refreshTokenSecretCreatedAt) {
        return true;
    }

    const now = new Date();
    const createdAt = new Date(this.refreshTokenSecretCreatedAt);
    const daysSinceCreation = (now - createdAt) / (1000 * 60 * 60 * 24);

    return daysSinceCreation >= 30;
};

/**
 * Regenerate refresh token secret
 * This will invalidate all existing tokens for this user
 * @returns {Promise<User>}
 */
userSchema.methods.regenerateRefreshTokenSecret = async function () {
    this.refreshTokenSecret = this.generateRefreshTokenSecret();
    this.refreshTokenSecretCreatedAt = new Date();

    global.logger.logInfo(`Regenerated refresh token secret for user: ${this.email}`);

    return this.save();
};

/**
 * Ensure user has a refresh token secret
 * Generate one if it doesn't exist or needs regeneration
 * @returns {Promise<User>}
 */
userSchema.methods.ensureRefreshTokenSecret = async function () {
    if (this.needsSecretRegeneration()) {
        await this.regenerateRefreshTokenSecret();
    }
    return this;
};

/**
 * Get the user's refresh token secret
 * Auto-generates if missing
 * @returns {Promise<string>}
 */
userSchema.methods.getRefreshTokenSecret = async function () {
    // Need to explicitly select the secret field since it's excluded by default
    if (!this.refreshTokenSecret) {
        const userWithSecret = await this.constructor
            .findById(this._id)
            .select('+refreshTokenSecret +refreshTokenSecretCreatedAt');

        if (!userWithSecret.refreshTokenSecret) {
            await userWithSecret.regenerateRefreshTokenSecret();
            this.refreshTokenSecret = userWithSecret.refreshTokenSecret;
            this.refreshTokenSecretCreatedAt = userWithSecret.refreshTokenSecretCreatedAt;
        } else {
            this.refreshTokenSecret = userWithSecret.refreshTokenSecret;
            this.refreshTokenSecretCreatedAt = userWithSecret.refreshTokenSecretCreatedAt;
        }
    }

    // Check if needs regeneration
    if (this.needsSecretRegeneration()) {
        await this.regenerateRefreshTokenSecret();
    }

    return this.refreshTokenSecret;
};

// Static method to find or create user from Google profile
userSchema.statics.findOrCreateFromGoogle = async function (profile) {
    try {
        // Try to find existing user - explicitly select secret fields
        let user = await this.findOne({ googleId: profile.id })
            .select('+refreshTokenSecret +refreshTokenSecretCreatedAt');

        if (user) {
            // Update user info from Google profile
            user.name = profile.displayName || user.name;
            user.email = profile.emails?.[0]?.value || user.email;
            user.picture = profile.photos?.[0]?.value || user.picture;
            await user.updateLastLogin();

            // Ensure user has a refresh token secret
            await user.ensureRefreshTokenSecret();

            return user;
        }

        // Create new user
        user = new this({
            googleId: profile.id,
            email: profile.emails?.[0]?.value,
            name: profile.displayName,
            picture: profile.photos?.[0]?.value
        });

        // Generate initial refresh token secret
        user.refreshTokenSecret = user.generateRefreshTokenSecret();
        user.refreshTokenSecretCreatedAt = new Date();

        await user.save();

        global.logger.logInfo(`New user created with refresh token secret: ${user.email}`);

        return user;
    } catch (error) {
        global.logger.logError(`Failed to find or create user: ${error.message}`);
        throw new Error(`Failed to find or create user: ${error.message}`);
    }
};

module.exports = mongoose.model('User', userSchema);