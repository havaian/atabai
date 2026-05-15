/**
 * Locales admin controller — read/write translation keys stored in MongoDB.
 *
 * All routes under /api/admin/locales/* are gated by requireAdminVerified.
 * Mutating routes additionally require super_admin (set up in routes.js).
 *
 * Public (within admin) read endpoint /api/admin/locales/bundle/:app/:lang is
 * NOT mounted here — see public bundle controller (it's exposed without admin
 * auth so the frontend can fetch fresh translations for everyone, not just
 * admins).
 */

const LocaleKey = require('./models/localeKey.model');
const localeSeed = require('./localeSeed');

const ALLOWED_LANGS = ['ru', 'en', 'uz'];
const ALLOWED_APPS = ['user', 'admin'];

/**
 * GET /api/admin/locales
 *
 * Query params:
 *   - app=user|admin       (optional filter)
 *   - namespace=admin      (optional — top-level namespace prefix)
 *   - q=foo                (optional — substring match on key or any value)
 *   - missing=ru|en|uz     (optional — only keys with no value for this language)
 *   - page=1, limit=50     (pagination; limit capped at 200)
 *
 * Returns: { keys: [...], pagination: { page, limit, total, pages } }
 */
async function listKeys(req, res) {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));

        const filter = {};
        if (req.query.app && ALLOWED_APPS.includes(req.query.app)) {
            filter.app = req.query.app;
        }
        if (req.query.namespace) {
            filter.namespace = String(req.query.namespace);
        }
        if (req.query.missing && ALLOWED_LANGS.includes(req.query.missing)) {
            // Match where values.{lang} is null or absent or empty string
            filter.$or = [
                { [`values.${req.query.missing}`]: null },
                { [`values.${req.query.missing}`]: '' },
                { [`values.${req.query.missing}`]: { $exists: false } }
            ];
        }
        if (req.query.q) {
            // Escape regex special chars
            const safe = String(req.query.q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const rx = new RegExp(safe, 'i');
            const search = [
                { key: rx },
                { 'values.ru': rx },
                { 'values.en': rx },
                { 'values.uz': rx }
            ];
            // Combine with existing $or (missing filter) using $and
            if (filter.$or) {
                filter.$and = [{ $or: filter.$or }, { $or: search }];
                delete filter.$or;
            } else {
                filter.$or = search;
            }
        }

        const total = await LocaleKey.countDocuments(filter);
        const keys = await LocaleKey.find(filter)
            .sort({ app: 1, key: 1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .populate('updatedBy', 'email name')
            .lean();

        res.json({
            success: true,
            keys,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit) || 1
            }
        });
    } catch (err) {
        global.logger.logError(err, { context: 'locales.listKeys' });
        res.status(500).json({ error: 'LIST_FAILED', message: err.message });
    }
}

/**
 * GET /api/admin/locales/namespaces
 * Returns distinct namespaces grouped by app for filter dropdowns.
 *
 * Response: { user: ['nav','auth',...], admin: ['common','users','mappings',...] }
 */
async function listNamespaces(req, res) {
    try {
        const userNs = await LocaleKey.distinct('namespace', { app: 'user' });
        const adminNs = await LocaleKey.distinct('namespace', { app: 'admin' });
        res.json({
            success: true,
            user: userNs.filter(Boolean).sort(),
            admin: adminNs.filter(Boolean).sort()
        });
    } catch (err) {
        global.logger.logError(err, { context: 'locales.listNamespaces' });
        res.status(500).json({ error: 'NAMESPACES_FAILED', message: err.message });
    }
}

/**
 * GET /api/admin/locales/stats
 * Counts per app: total keys, missing per language.
 */
async function getStats(req, res) {
    try {
        const stats = {};
        for (const app of ALLOWED_APPS) {
            const total = await LocaleKey.countDocuments({ app });
            const missing = {};
            for (const lang of ALLOWED_LANGS) {
                missing[lang] = await LocaleKey.countDocuments({
                    app,
                    $or: [
                        { [`values.${lang}`]: null },
                        { [`values.${lang}`]: '' },
                        { [`values.${lang}`]: { $exists: false } }
                    ]
                });
            }
            stats[app] = { total, missing };
        }
        res.json({ success: true, stats });
    } catch (err) {
        global.logger.logError(err, { context: 'locales.getStats' });
        res.status(500).json({ error: 'STATS_FAILED', message: err.message });
    }
}

/**
 * PATCH /api/admin/locales/keys/:keyId
 * Body: { values: { ru?, en?, uz? }, notes? }
 *
 * Only provided languages are updated — partial updates are fine.
 * Setting a value to null/empty string clears it (becomes "missing").
 */
async function updateKey(req, res) {
    try {
        const { keyId } = req.params;
        const { values, notes } = req.body || {};

        const doc = await LocaleKey.findById(keyId);
        if (!doc) {
            return res.status(404).json({ error: 'NOT_FOUND', message: 'Locale key not found' });
        }

        if (values && typeof values === 'object') {
            for (const lang of ALLOWED_LANGS) {
                if (Object.prototype.hasOwnProperty.call(values, lang)) {
                    const v = values[lang];
                    // null or empty string both clear the value
                    doc.values[lang] = (v === null || v === '') ? null : String(v);
                }
            }
        }

        if (typeof notes === 'string') {
            doc.notes = notes.trim() || null;
        }

        doc.source = 'db';
        doc.updatedBy = req.user._id;
        await doc.save();

        // Bump bundle version so frontend refetches on next poll
        bumpBundleVersion(doc.app);

        global.logger.logSecurity('Locale key updated', {
            adminId: req.user._id,
            adminEmail: req.user.email,
            keyId,
            key: doc.key,
            app: doc.app
        });

        res.json({ success: true, key: doc });
    } catch (err) {
        global.logger.logError(err, { context: 'locales.updateKey' });
        res.status(500).json({ error: 'UPDATE_FAILED', message: err.message });
    }
}

/**
 * POST /api/admin/locales/keys
 * Body: { key, app, values: { ru?, en?, uz? }, notes? }
 *
 * Creates a new locale key. App must be 'user' or 'admin'. Key must be unique.
 * Use for adding keys that aren't yet referenced in code (rare — usually keys
 * appear in code first, then get seeded from JSON files).
 */
async function createKey(req, res) {
    try {
        const { key, app, values, notes } = req.body || {};
        if (!key || typeof key !== 'string' || !key.trim()) {
            return res.status(400).json({ error: 'INVALID_KEY', message: 'Key is required' });
        }
        if (!ALLOWED_APPS.includes(app)) {
            return res.status(400).json({ error: 'INVALID_APP', message: 'App must be user or admin' });
        }

        const trimmedKey = key.trim();
        const existing = await LocaleKey.findOne({ key: trimmedKey });
        if (existing) {
            return res.status(409).json({ error: 'DUPLICATE_KEY', message: 'Key already exists' });
        }

        const built = {
            ru: values?.ru ? String(values.ru) : null,
            en: values?.en ? String(values.en) : null,
            uz: values?.uz ? String(values.uz) : null
        };

        const doc = await LocaleKey.create({
            key: trimmedKey,
            namespace: LocaleKey.deriveNamespace(trimmedKey),
            app,
            values: built,
            notes: typeof notes === 'string' ? notes.trim() || null : null,
            source: 'db',
            updatedBy: req.user._id
        });

        bumpBundleVersion(app);

        global.logger.logSecurity('Locale key created', {
            adminId: req.user._id,
            adminEmail: req.user.email,
            keyId: doc._id,
            key: doc.key,
            app: doc.app
        });

        res.status(201).json({ success: true, key: doc });
    } catch (err) {
        global.logger.logError(err, { context: 'locales.createKey' });
        res.status(500).json({ error: 'CREATE_FAILED', message: err.message });
    }
}

/**
 * DELETE /api/admin/locales/keys/:keyId
 *
 * Permanently removes the key. Use with caution — if the key is referenced
 * in code, $t() will fall back to the key string itself (visible glitch).
 */
async function deleteKey(req, res) {
    try {
        const { keyId } = req.params;
        const doc = await LocaleKey.findById(keyId);
        if (!doc) {
            return res.status(404).json({ error: 'NOT_FOUND', message: 'Locale key not found' });
        }

        const snapshot = { key: doc.key, app: doc.app };
        await doc.deleteOne();

        bumpBundleVersion(snapshot.app);

        global.logger.logSecurity('Locale key deleted', {
            adminId: req.user._id,
            adminEmail: req.user.email,
            keyId,
            key: snapshot.key,
            app: snapshot.app
        });

        res.json({ success: true });
    } catch (err) {
        global.logger.logError(err, { context: 'locales.deleteKey' });
        res.status(500).json({ error: 'DELETE_FAILED', message: err.message });
    }
}

/**
 * POST /api/admin/locales/seed
 * Manually trigger a seed (super_admin only). Useful after editing JSON files
 * directly on disk (rare — usually you'd just edit in DB via the UI).
 * Idempotent — won't overwrite existing keys.
 */
async function manualSeed(req, res) {
    try {
        const results = await localeSeed.runSeed();
        bumpBundleVersion('user');
        bumpBundleVersion('admin');

        global.logger.logSecurity('Locale seed run manually', {
            adminId: req.user._id,
            adminEmail: req.user.email,
            results
        });

        res.json({ success: true, results });
    } catch (err) {
        global.logger.logError(err, { context: 'locales.manualSeed' });
        res.status(500).json({ error: 'SEED_FAILED', message: err.message });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC bundle endpoint — used by frontend i18n loader to fetch translations.
// Exposed without admin auth (mounted in main app, not on admin router).
// In-memory version counter lets clients poll for changes cheaply.
// ─────────────────────────────────────────────────────────────────────────────

// Per-app bundle version. Bumped on any mutation (create/update/delete/seed).
// Frontend polls /api/locales/version periodically; if version differs from
// what it has cached, it re-fetches the full bundle.
const bundleVersions = { user: 1, admin: 1 };

function bumpBundleVersion(app) {
    if (bundleVersions[app] !== undefined) {
        bundleVersions[app] += 1;
    }
}

function getBundleVersions() {
    return { ...bundleVersions };
}

/**
 * GET /api/locales/version
 * Returns current bundle versions. Used by frontend polling for hot-reload.
 */
async function publicGetVersions(req, res) {
    res.json({ success: true, versions: getBundleVersions() });
}

/**
 * GET /api/locales/bundle/:app/:lang
 * Returns nested JSON object (vue-i18n compatible) for the given app+language.
 *
 * :app ∈ {user, admin}, :lang ∈ {ru, en, uz}
 *
 * Output is the same shape as the original JSON files:
 *   { admin: { users: { title: "..." } } }  for app=admin
 *   { nav: {...}, auth: {...} }              for app=user
 *
 * Public endpoint (no auth) — translations aren't sensitive data, every visitor
 * needs them. Cached server-side per (app, lang) by bundleVersion.
 */
const bundleCache = {}; // key = `${app}:${lang}:${version}`, value = nested object

async function publicGetBundle(req, res) {
    try {
        const { app, lang } = req.params;
        if (!ALLOWED_APPS.includes(app)) {
            return res.status(400).json({ error: 'INVALID_APP' });
        }
        if (!ALLOWED_LANGS.includes(lang)) {
            return res.status(400).json({ error: 'INVALID_LANG' });
        }

        const version = bundleVersions[app];
        const cacheKey = `${app}:${lang}:${version}`;
        if (bundleCache[cacheKey]) {
            return res.json({
                success: true,
                version,
                bundle: bundleCache[cacheKey]
            });
        }

        const docs = await LocaleKey.find({ app }).select(`key values.${lang}`).lean();
        // Rebuild nested object from flat keys
        const nested = {};
        for (const doc of docs) {
            const value = doc.values?.[lang];
            if (value === null || value === undefined || value === '') continue;
            setNested(nested, doc.key, value);
        }

        // Drop old cache entries for this app+lang (keep only current version)
        for (const k of Object.keys(bundleCache)) {
            if (k.startsWith(`${app}:${lang}:`) && k !== cacheKey) {
                delete bundleCache[k];
            }
        }
        bundleCache[cacheKey] = nested;

        res.json({ success: true, version, bundle: nested });
    } catch (err) {
        global.logger.logError(err, { context: 'locales.publicGetBundle' });
        res.status(500).json({ error: 'BUNDLE_FAILED', message: err.message });
    }
}

/**
 * Assigns a value at a dotted-path inside a nested object.
 * "admin.users.title" + "X" → { admin: { users: { title: "X" } } }
 */
function setNested(target, dottedKey, value) {
    const parts = dottedKey.split('.');
    let cur = target;
    for (let i = 0; i < parts.length - 1; i++) {
        const p = parts[i];
        if (typeof cur[p] !== 'object' || cur[p] === null) {
            cur[p] = {};
        }
        cur = cur[p];
    }
    cur[parts[parts.length - 1]] = value;
}

module.exports = {
    // admin (gated)
    listKeys,
    listNamespaces,
    getStats,
    updateKey,
    createKey,
    deleteKey,
    manualSeed,
    // public bundle
    publicGetVersions,
    publicGetBundle,
    // exposed for tests / startup
    bumpBundleVersion,
    getBundleVersions
};
