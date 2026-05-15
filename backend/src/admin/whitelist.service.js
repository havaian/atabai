// backend/src/admin/whitelist.service.js

const EmailWhitelist = require('./models/emailWhitelist.model');
const User = require('../user/model');

/**
 * Returns true if the email whitelist feature is enabled via ENV.
 * Source of truth — single check site for the flag.
 */
function isWhitelistEnabled() {
    return process.env.ENABLE_EMAIL_WHITELIST === 'true';
}

/**
 * Check if an email is permitted to log in.
 * Returns `true` immediately if whitelist is disabled (open mode).
 * Returns `true` if email is in EmailWhitelist collection.
 * Returns `false` otherwise.
 *
 * @param {string} email
 * @returns {Promise<boolean>}
 */
async function isEmailAllowed(email) {
    if (!isWhitelistEnabled()) return true;
    if (!email || typeof email !== 'string') return false;
    const normalized = email.toLowerCase().trim();
    const entry = await EmailWhitelist.findOne({ email: normalized }).lean();
    return !!entry;
}

/**
 * One-time bootstrap: if whitelist is enabled AND the collection is empty,
 * auto-seed it from all current users so we don't lock everyone out on first
 * enable. Idempotent — safe to call at every startup.
 *
 * Returns { seeded: number } — how many entries were inserted, or 0 if no-op.
 */
async function bootstrapFromExistingUsers() {
    if (!isWhitelistEnabled()) return { seeded: 0, skipped: 'whitelist_disabled' };

    const existingCount = await EmailWhitelist.estimatedDocumentCount();
    if (existingCount > 0) return { seeded: 0, skipped: 'already_populated' };

    const users = await User.find({}, { email: 1 }).lean();
    if (users.length === 0) return { seeded: 0, skipped: 'no_users' };

    // De-dupe in case of any data anomalies
    const seen = new Set();
    const docs = [];
    for (const u of users) {
        if (!u.email) continue;
        const norm = u.email.toLowerCase().trim();
        if (seen.has(norm)) continue;
        seen.add(norm);
        docs.push({ email: norm, addedBy: null, note: 'Auto-seeded on whitelist enable' });
    }

    if (docs.length === 0) return { seeded: 0, skipped: 'no_valid_emails' };

    // ordered: false — tolerate duplicate key races if seed runs twice
    await EmailWhitelist.insertMany(docs, { ordered: false });
    return { seeded: docs.length };
}

/**
 * Best-effort bootstrap for startup. Errors logged, not thrown.
 */
async function runBootstrapAtStartup() {
    try {
        const result = await bootstrapFromExistingUsers();
        if (result.seeded > 0) {
            global.logger.logInfo(`Email whitelist bootstrap: seeded ${result.seeded} existing users`, {
                category: 'startup'
            });
        }
    } catch (err) {
        global.logger.logError(err, { context: 'whitelist.runBootstrapAtStartup' });
    }
}

module.exports = {
    isWhitelistEnabled,
    isEmailAllowed,
    bootstrapFromExistingUsers,
    runBootstrapAtStartup
};
