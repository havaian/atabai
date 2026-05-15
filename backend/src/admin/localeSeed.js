/**
 * Locale seed — populates the database with translation keys from JSON files
 * shipped in backend/src/admin/seedLocales/.
 *
 * Strategy:
 *   - Each file (ru.json / en.json / uz.json for user app; admin-*.json for admin app)
 *     is flattened: {a: {b: {c: "x"}}} → {"a.b.c": "x"}
 *   - For each unique key, build a values: {ru, en, uz} object by reading the
 *     same key from all three language files of the same app.
 *   - Insert keys not yet in DB; existing keys are NOT overwritten (DB is the
 *     source of truth after the first bootstrap).
 *   - Files in src/admin/seedLocales/ remain as reset / fallback source.
 *
 * Idempotency: re-running this is safe. It only inserts missing keys.
 *
 * NOTE about sync with frontend locale files:
 *   The seed source lives in backend/src/admin/seedLocales/ because Docker
 *   only copies the backend folder. When frontend locale files change in
 *   frontend/src/locales/, copy them to backend/src/admin/seedLocales/
 *   manually before rebuilding the backend image. After bootstrap, the DB is
 *   authoritative — file edits won't affect already-seeded keys.
 */

const fs = require('fs');
const path = require('path');
const LocaleKey = require('./models/localeKey.model');

const SEED_DIR = path.join(__dirname, 'seedLocales');

/**
 * Recursively flatten a nested object to dotted keys with string leaves.
 * Non-string leaves are ignored (we don't support arrays/numbers in i18n bundle).
 */
function flatten(obj, prefix = '') {
    const out = {};
    if (!obj || typeof obj !== 'object') return out;
    for (const k of Object.keys(obj)) {
        const v = obj[k];
        const fullKey = prefix ? `${prefix}.${k}` : k;
        if (v && typeof v === 'object' && !Array.isArray(v)) {
            Object.assign(out, flatten(v, fullKey));
        } else if (typeof v === 'string') {
            out[fullKey] = v;
        }
        // Arrays, numbers, booleans, null — skip silently. i18n keys should be strings.
    }
    return out;
}

/**
 * Read one JSON file (best-effort) and return flattened key-value map.
 * Returns {} if the file is missing or unparseable.
 */
function readLocaleFile(filename) {
    const filePath = path.join(SEED_DIR, filename);
    try {
        const raw = fs.readFileSync(filePath, 'utf8');
        const parsed = JSON.parse(raw);
        return flatten(parsed);
    } catch (err) {
        global.logger.logError(err, {
            context: 'localeSeed.readLocaleFile',
            file: filename,
            category: 'startup'
        });
        return {};
    }
}

/**
 * Seed locale keys for one app scope ('user' or 'admin') across all three languages.
 * @param {'user'|'admin'} app
 * @returns {Promise<{ inserted: number, total: number }>}
 */
async function seedApp(app) {
    const prefix = app === 'admin' ? 'admin-' : '';
    const ruMap = readLocaleFile(`${prefix}ru.json`);
    const enMap = readLocaleFile(`${prefix}en.json`);
    const uzMap = readLocaleFile(`${prefix}uz.json`);

    // Union of keys across all three languages
    const allKeys = new Set([
        ...Object.keys(ruMap),
        ...Object.keys(enMap),
        ...Object.keys(uzMap)
    ]);

    if (allKeys.size === 0) {
        return { inserted: 0, total: 0 };
    }

    // Fetch existing keys in one query to avoid N round-trips
    const existing = await LocaleKey.find({
        app,
        key: { $in: Array.from(allKeys) }
    }).select('key').lean();
    const existingSet = new Set(existing.map(d => d.key));

    const toInsert = [];
    for (const key of allKeys) {
        if (existingSet.has(key)) continue;
        toInsert.push({
            key,
            namespace: LocaleKey.deriveNamespace(key),
            app,
            values: {
                ru: ruMap[key] ?? null,
                en: enMap[key] ?? null,
                uz: uzMap[key] ?? null
            },
            source: 'file'
        });
    }

    if (toInsert.length === 0) {
        return { inserted: 0, total: allKeys.size };
    }

    // ordered: false — if one insert fails (e.g. unique conflict from a race),
    // others still go through. Each doc has a unique key constraint.
    try {
        await LocaleKey.insertMany(toInsert, { ordered: false });
    } catch (err) {
        // Duplicate key errors are expected if another startup raced us; log and continue.
        if (err.code !== 11000 && err.writeErrors) {
            global.logger.logError(err, {
                context: 'localeSeed.seedApp.insertMany',
                app,
                errorCount: err.writeErrors.length
            });
        }
    }

    return { inserted: toInsert.length, total: allKeys.size };
}

/**
 * Run seed for both user and admin apps.
 */
async function runSeed() {
    const user = await seedApp('user');
    const admin = await seedApp('admin');
    return { user, admin };
}

/**
 * Best-effort idempotent seed run at startup. Errors are caught — they cannot
 * block server startup. Logs summary of what was inserted (if anything).
 */
async function runSeedAtStartup() {
    try {
        const results = await runSeed();
        const summary = [];
        if (results.user.inserted > 0) {
            summary.push(`user: ${results.user.inserted}/${results.user.total} new`);
        }
        if (results.admin.inserted > 0) {
            summary.push(`admin: ${results.admin.inserted}/${results.admin.total} new`);
        }
        if (summary.length > 0) {
            global.logger.logInfo(`Locale seed inserted keys — ${summary.join(', ')}`, {
                category: 'startup'
            });
        }
    } catch (err) {
        global.logger.logError(err, { context: 'localeSeed.runSeedAtStartup' });
    }
}

module.exports = {
    runSeed,
    runSeedAtStartup,
    seedApp,
    flatten,        // exported for tests / debugging
    readLocaleFile
};
