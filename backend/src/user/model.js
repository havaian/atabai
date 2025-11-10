const mongoose = require('mongoose');

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
    }
}, {
    timestamps: true,
    toJSON: {
        transform: function (doc, ret) {
            // Remove sensitive fields from JSON output
            delete ret.__v;
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
userSchema.methods.canProcessFiles = function () {
    const monthlyLimit = this.subscriptionType === 'basic' ? 5 : Infinity;
    return this.filesProcessedThisMonth < monthlyLimit && this.isActive;
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

// Static method to find or create user from Google profile
userSchema.statics.findOrCreateFromGoogle = async function (profile) {
    try {
        // Try to find existing user
        let user = await this.findOne({ googleId: profile.id });

        if (user) {
            // Update user info from Google profile
            user.name = profile.displayName || user.name;
            user.email = profile.emails?.[0]?.value || user.email;
            user.picture = profile.photos?.[0]?.value || user.picture;
            await user.updateLastLogin();
            return user;
        }

        // Create new user
        user = new this({
            googleId: profile.id,
            email: profile.emails?.[0]?.value,
            name: profile.displayName,
            picture: profile.photos?.[0]?.value
        });

        await user.save();
        return user;
    } catch (error) {
        throw new Error(`Failed to find or create user: ${error.message}`);
    }
};

module.exports = mongoose.model('User', userSchema);