// backend/src/admin/whitelist.controller.js

const EmailWhitelist = require('./models/emailWhitelist.model');
const { isWhitelistEnabled } = require('./whitelist.service');

/**
 * GET /api/admin/whitelist
 * Returns whitelist state + all entries.
 * Pagination kept simple — we don't expect more than a few hundred entries.
 */
async function listWhitelist(req, res) {
    try {
        const entries = await EmailWhitelist.find({})
            .populate('addedBy', 'email name')
            .sort({ createdAt: -1 })
            .lean();
        res.json({
            success: true,
            enabled: isWhitelistEnabled(),
            entries
        });
    } catch (err) {
        global.logger.logError(err, { context: 'whitelist.listWhitelist' });
        res.status(500).json({ error: 'LIST_FAILED', message: 'Failed to list whitelist' });
    }
}

/**
 * POST /api/admin/whitelist
 * Body: { email: string, note?: string }
 * Adds a single email. Idempotent — returns 409 if already exists.
 */
async function addEntry(req, res) {
    try {
        const { email, note } = req.body || {};
        if (!email || typeof email !== 'string' || !email.includes('@')) {
            return res.status(400).json({ error: 'INVALID_EMAIL', message: 'Valid email required' });
        }

        const normalized = email.toLowerCase().trim();
        const existing = await EmailWhitelist.findOne({ email: normalized });
        if (existing) {
            return res.status(409).json({ error: 'DUPLICATE', message: 'Email already in whitelist' });
        }

        const entry = await EmailWhitelist.create({
            email: normalized,
            addedBy: req.user._id,
            note: typeof note === 'string' ? note.trim() : ''
        });

        global.logger.logSecurity('Email added to whitelist', {
            adminId: req.user._id,
            email: normalized
        }, 'info');

        res.status(201).json({ success: true, entry });
    } catch (err) {
        global.logger.logError(err, { context: 'whitelist.addEntry' });
        res.status(500).json({ error: 'ADD_FAILED', message: 'Failed to add entry' });
    }
}

/**
 * POST /api/admin/whitelist/bulk
 * Body: { emails: string[], note?: string }
 * Adds multiple emails at once. Returns { added: number, skipped: number }.
 * Invalid emails silently skipped; duplicates skipped.
 */
async function bulkAdd(req, res) {
    try {
        const { emails, note } = req.body || {};
        if (!Array.isArray(emails) || emails.length === 0) {
            return res.status(400).json({ error: 'INVALID_EMAILS', message: 'emails array required' });
        }

        // Normalize, dedup, validate
        const seen = new Set();
        const docs = [];
        for (const raw of emails) {
            if (typeof raw !== 'string') continue;
            const norm = raw.toLowerCase().trim();
            if (!norm || !norm.includes('@') || seen.has(norm)) continue;
            seen.add(norm);
            docs.push({
                email: norm,
                addedBy: req.user._id,
                note: typeof note === 'string' ? note.trim() : ''
            });
        }

        if (docs.length === 0) {
            return res.json({ success: true, added: 0, skipped: emails.length, message: 'No valid emails' });
        }

        // ordered: false — duplicates throw but other inserts succeed
        let added = 0;
        try {
            const result = await EmailWhitelist.insertMany(docs, { ordered: false });
            added = result.length;
        } catch (bulkErr) {
            // BulkWriteError: succeeded inserts in `insertedDocs` (Mongoose 7+ exposes `result.insertedCount`)
            if (bulkErr.result && typeof bulkErr.result.insertedCount === 'number') {
                added = bulkErr.result.insertedCount;
            } else if (Array.isArray(bulkErr.insertedDocs)) {
                added = bulkErr.insertedDocs.length;
            }
        }

        global.logger.logSecurity('Bulk whitelist add', {
            adminId: req.user._id,
            attempted: docs.length,
            added
        }, 'info');

        res.json({ success: true, added, skipped: docs.length - added });
    } catch (err) {
        global.logger.logError(err, { context: 'whitelist.bulkAdd' });
        res.status(500).json({ error: 'BULK_FAILED', message: 'Bulk add failed' });
    }
}

/**
 * DELETE /api/admin/whitelist/:entryId
 * Removes an email from the whitelist. Already-registered users remain in
 * the User collection — to also block them, deactivate via the user admin
 * endpoint (`PATCH /api/admin/users/:id/active { isActive: false }`).
 */
async function removeEntry(req, res) {
    try {
        const { entryId } = req.params;
        const entry = await EmailWhitelist.findById(entryId);
        if (!entry) {
            return res.status(404).json({ error: 'NOT_FOUND', message: 'Entry not found' });
        }

        const snapshot = { email: entry.email };
        await entry.deleteOne();

        global.logger.logSecurity('Email removed from whitelist', {
            adminId: req.user._id,
            email: snapshot.email
        }, 'info');

        res.json({ success: true });
    } catch (err) {
        global.logger.logError(err, { context: 'whitelist.removeEntry' });
        res.status(500).json({ error: 'DELETE_FAILED', message: 'Failed to delete entry' });
    }
}

module.exports = {
    listWhitelist,
    addEntry,
    bulkAdd,
    removeEntry
};
