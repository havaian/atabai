const mongoose = require('mongoose');

/**
 * LocaleKey — one document per translation key, with values for all languages
 * in a single document.
 *
 * Why flat (one doc per key) instead of nested or per-language:
 *   - Editor UX: one row per key, 3 columns of values, easy inline edit
 *   - Atomic multi-language updates
 *   - Easy "missing translations" query: `values.en: null`
 *   - Stable identity for a key as it moves across files
 *
 * Scope:
 *   - `app: 'user'` keys come from frontend/src/locales/{ru,en,uz}.json
 *   - `app: 'admin'` keys come from frontend/src/locales/admin-{ru,en,uz}.json
 *   The split lets the frontend pull only the admin namespace on /admin routes
 *   without fetching 700+ user-app keys.
 *
 * Bootstrap behaviour:
 *   - On first startup, loadStartupSeed() reads the JSON files and inserts any
 *     keys not yet in the DB. Existing keys are NOT overwritten — DB is the
 *     source of truth after bootstrap.
 *   - Files remain on disk as reset / fallback source.
 */
const localeKeySchema = new mongoose.Schema(
    {
        key: {
            type: String,
            required: true,
            unique: true,
            index: true,
            trim: true
        },
        // Top-level namespace prefix derived from key (e.g. "admin", "dashboard", "auth")
        // Used for fast filtering in the editor without scanning all keys.
        namespace: {
            type: String,
            index: true,
            trim: true
        },
        // Which app this key belongs to.
        // 'user'  → loaded for the main application (ru.json / en.json / uz.json)
        // 'admin' → loaded only for /admin routes (admin-ru.json / admin-en.json / admin-uz.json)
        app: {
            type: String,
            enum: ['user', 'admin'],
            required: true,
            index: true
        },
        values: {
            ru: { type: String, default: null },
            en: { type: String, default: null },
            uz: { type: String, default: null }
        },
        // Where the value came from. 'file' = seeded from JSON, 'db' = edited via admin UI.
        // After any admin edit, source becomes 'db' — used to display "edited" badges in UI.
        source: {
            type: String,
            enum: ['file', 'db'],
            default: 'file'
        },
        notes: {
            type: String,
            default: null,
            trim: true
        },
        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null
        }
    },
    { timestamps: true }
);

// Compound index for editor filters
localeKeySchema.index({ app: 1, namespace: 1, key: 1 });

// Helper to derive namespace from a dotted key.
// "admin.users.title" → "admin"
// "dashboard.welcome" → "dashboard"
// "topLevel"          → null (top-level keys have no namespace)
localeKeySchema.statics.deriveNamespace = function (key) {
    if (!key || typeof key !== 'string') return null;
    const dot = key.indexOf('.');
    return dot === -1 ? null : key.substring(0, dot);
};

module.exports = mongoose.model('LocaleKey', localeKeySchema);
