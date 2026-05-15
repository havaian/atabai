// backend/src/admin/models/emailWhitelist.model.js

const mongoose = require('mongoose');

/**
 * EmailWhitelist — explicit allowlist of email addresses permitted to register
 * and log in to ATABAI.
 *
 * Activated via ENV `ENABLE_EMAIL_WHITELIST=true`. When disabled (default),
 * this collection is ignored and the platform behaves as open registration.
 *
 * Design choice: emails live as their own collection (not a flag on User)
 * because we need to pre-authorize emails BEFORE a User document exists —
 * the first time someone with a whitelisted email signs in, the OAuth
 * callback creates their User on the fly.
 *
 * Block existing users: handled separately via `User.isActive = false`.
 */
const emailWhitelistSchema = new mongoose.Schema({
    // Lowercased, trimmed. Unique constraint enforces dedup.
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        index: true
    },
    // Admin who added the entry. Null for entries created during initial
    // auto-seed of existing users.
    addedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    // Free-text label (e.g. "Big4 PwC contact — Suhrob Azimov")
    note: {
        type: String,
        default: ''
    }
}, {
    timestamps: { createdAt: true, updatedAt: false }
});

module.exports = mongoose.model('EmailWhitelist', emailWhitelistSchema);
