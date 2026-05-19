/**
 * Mapping resolver.
 *
 * Provides DB-backed mappings (with fallback to the original file constants)
 * for transformers and extractors.
 *
 * Returns objects with the SAME shape as the original file exports so the
 * existing transformer/extractor code keeps working without rewrites:
 *
 *   - getBalanceSheetMapping(userId?)     → { '010': {...}, '012': {...}, ... }
 *   - getCashFlowMapping(userId?)         → same shape
 *   - getProfitLossForm2Mapping(userId?)  → same shape
 *   - getEquityMapping(userId?)           → { EQUITY_COLUMNS, BS_ROW_TO_EQUITY_COLUMN,
 *                                             EQUITY_MOVEMENT_ROWS, FORM4_ROW_PATTERNS,
 *                                             FORM4_COLUMN_PATTERNS }
 *
 * The userId parameter is currently a placeholder for upcoming per-user
 * mapping set assignment (see MappingSet.assignedUsers). It is kept in the
 * signature so call sites don't need to change when that wiring lands.
 *
 * Caching strategy:
 *   - Global mappings are cached per reportType for 60s.
 *     Cache key contains the published MappingSet id; if a new draft is
 *     published, the new id invalidates the cache automatically.
 *
 * Failure mode:
 *   - DB read error or no published set → fallback to file constants
 *     (logged once per minute to avoid spam).
 */

'use strict';

const MappingSet = require('../admin/models/mappingSet.model');
const RowMapping = require('../admin/models/rowMapping.model');
const EquityMappingConfig = require('../admin/models/equityMappingConfig.model');

// File-constant fallbacks (these are the source of truth before Stage 3a seed,
// and remain the safety net afterward).
const fileBalanceSheet = require('../mappings/accountMapping');
const fileCashFlow = require('../mappings/cashFlowMapping');
const fileProfitLossF2 = require('../mappings/profitLossForm2Mapping');
const fileEquity = require('../mappings/equityMapping');

const CACHE_TTL_MS = 60 * 1000;
const FALLBACK_LOG_INTERVAL_MS = 60 * 1000;

const globalCache = new Map(); // reportType -> { setId, data, expiresAt }
const lastFallbackLog = new Map(); // reportType -> timestamp

function logFallback(reportType, reason) {
    const now = Date.now();
    const last = lastFallbackLog.get(reportType) || 0;
    if (now - last < FALLBACK_LOG_INTERVAL_MS) return;
    lastFallbackLog.set(reportType, now);
    global.logger?.logInfo?.(
        `Mapping resolver: falling back to file constants for '${reportType}' (${reason})`,
        { category: 'mappings' }
    );
}

/**
 * Convert a RowMapping DB doc to the file-constant shape.
 * The shape is essentially: { nsbuCodes, nsbuDescription, ifrsClassification,
 *                              section, subsection, isNegative, isCalculated,
 *                              formula, flowType, directMethod, netCalculation,
 *                              label, accountDetails }.
 * `nsbuRowCode` is the key in the returned object (not a property).
 */
function rowDocToFileShape(doc) {
    const out = {
        nsbuCodes: doc.nsbuCodes || [],
        ifrsClassification: doc.ifrsClassification,
        section: doc.section || '',
    };
    if (doc.nsbuDescription) out.nsbuDescription = doc.nsbuDescription;
    if (doc.subsection) out.subsection = doc.subsection;
    if (doc.isNegative) out.isNegative = true;
    if (doc.isCalculated) out.isCalculated = true;
    if (doc.formula !== null && doc.formula !== undefined) out.formula = doc.formula;
    if (doc.flowType) out.flowType = doc.flowType;
    if (typeof doc.directMethod === 'boolean') out.directMethod = doc.directMethod;
    if (typeof doc.netCalculation === 'boolean') out.netCalculation = doc.netCalculation;
    if (doc.label) out.label = doc.label;
    if (doc.accountDetails) out.accountDetails = doc.accountDetails;
    return out;
}

/**
 * Load the published row-based mapping for a reportType from DB, with caching.
 * Returns the file-shape object, or null if no published set / DB error.
 *
 * Resolution order:
 *   1. If userId is provided, look for a published USER-SPECIFIC set whose
 *      assignedUsers contains this user.
 *   2. Otherwise (or as fallback), look for the published GLOBAL set
 *      (assignedUsers empty).
 *
 * Cache key includes the userId for user-specific resolutions so a user
 * picking up a custom set doesn't poison the global cache and vice versa.
 * The cache value also stores the resolved setId — if the underlying set
 * is republished, the new set has a new _id, which forces a miss on next
 * read; invalidateMappingCache also wipes entries proactively on publish.
 */
async function loadRowBasedFromDb(reportType, userId) {
    const cacheKey = userId ? `${reportType}:${userId}` : reportType;
    const cached = globalCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.data;
    }

    try {
        // Step 1: try user-specific set if userId is given.
        let set = null;
        if (userId) {
            set = await MappingSet.findOne({
                reportType,
                status: 'published',
                assignedUsers: userId
            }).lean();
        }

        // Step 2: fall back to global published set (assignedUsers empty).
        if (!set) {
            set = await MappingSet.findOne({
                reportType,
                status: 'published',
                assignedUsers: { $size: 0 }
            }).lean();
        }

        if (!set) {
            return null;
        }
        const rows = await RowMapping.find({ mappingSetId: set._id }).lean();
        const out = {};
        for (const row of rows) {
            out[row.nsbuRowCode] = rowDocToFileShape(row);
        }
        globalCache.set(cacheKey, {
            setId: String(set._id),
            data: out,
            expiresAt: Date.now() + CACHE_TTL_MS
        });
        return out;
    } catch (err) {
        global.logger?.logError?.(err, { context: 'mappingResolver.loadRowBasedFromDb', reportType, userId });
        return null;
    }
}

// ─── Public API: row-based reports ────────────────────────────────────────────
// userId enables per-user MappingSet resolution: if a published user-specific
// set exists for this user, it is used; otherwise the global set is.

async function getBalanceSheetMapping(userId) {
    let base = await loadRowBasedFromDb('balance_sheet', userId);
    if (!base) {
        logFallback('balance_sheet', 'no published set in DB');
        base = fileBalanceSheet.BALANCE_SHEET_MAPPING;
    }
    return base;
}

async function getCashFlowMapping(userId) {
    let base = await loadRowBasedFromDb('cash_flow', userId);
    if (!base) {
        logFallback('cash_flow', 'no published set in DB');
        base = fileCashFlow.CASH_FLOW_MAPPING;
    }
    return base;
}

async function getProfitLossForm2Mapping(userId) {
    let base = await loadRowBasedFromDb('profit_loss_form2', userId);
    if (!base) {
        logFallback('profit_loss_form2', 'no published set in DB');
        base = fileProfitLossF2.FORM2_ROW_CODES;
    }
    return base;
}

// ─── Public API: equity ───────────────────────────────────────────────────────

/**
 * Equity mapping shape (matches src/mappings/equityMapping.js exports):
 *   { EQUITY_COLUMNS, BS_ROW_TO_EQUITY_COLUMN, EQUITY_MOVEMENT_ROWS,
 *     FORM4_ROW_PATTERNS, FORM4_COLUMN_PATTERNS }
 *
 * Resolution order mirrors loadRowBasedFromDb: user-specific published set
 * first, then global. The same caching strategy applies.
 */
async function getEquityMapping(userId) {
    const cacheKey = userId ? `equity:${userId}` : 'equity';
    const cached = globalCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.data;
    }

    try {
        let set = null;
        if (userId) {
            set = await MappingSet.findOne({
                reportType: 'equity',
                status: 'published',
                assignedUsers: userId
            }).lean();
        }
        if (!set) {
            set = await MappingSet.findOne({
                reportType: 'equity',
                status: 'published',
                assignedUsers: { $size: 0 }
            }).lean();
        }
        if (set) {
            const config = await EquityMappingConfig.findOne({ mappingSetId: set._id }).lean();
            if (config) {
                // Compile regex patterns back from { pattern, flags } string form.
                const compilePattern = (p) => ({
                    key: p.key,
                    pattern: new RegExp(p.pattern, p.flags || 'i')
                });

                const data = {
                    EQUITY_COLUMNS: config.columns.map(c => ({
                        key: c.key,
                        label: c.label,
                        nsbuRows: c.nsbuRows || [],
                        isNegative: !!c.isNegative,
                        isCalculated: !!c.isCalculated
                    })),
                    BS_ROW_TO_EQUITY_COLUMN: config.bsRowToEquityColumn
                        ? (config.bsRowToEquityColumn instanceof Map
                            ? Object.fromEntries(config.bsRowToEquityColumn)
                            : { ...config.bsRowToEquityColumn })
                        : {},
                    EQUITY_MOVEMENT_ROWS: config.movementRows.map(r => ({
                        key: r.key,
                        label: r.label,
                        isTotal: !!r.isTotal
                    })),
                    FORM4_ROW_PATTERNS: (config.rowPatterns || []).map(compilePattern),
                    FORM4_COLUMN_PATTERNS: (config.columnPatterns || []).map(compilePattern)
                };

                globalCache.set(cacheKey, {
                    setId: String(set._id),
                    data,
                    expiresAt: Date.now() + CACHE_TTL_MS
                });
                return data;
            }
        }
        logFallback('equity', 'no published set/config in DB');
    } catch (err) {
        global.logger?.logError?.(err, { context: 'mappingResolver.getEquityMapping', userId });
        logFallback('equity', 'DB error: ' + err.message);
    }

    // Fallback to file constants
    return {
        EQUITY_COLUMNS: fileEquity.EQUITY_COLUMNS,
        BS_ROW_TO_EQUITY_COLUMN: fileEquity.BS_ROW_TO_EQUITY_COLUMN,
        EQUITY_MOVEMENT_ROWS: fileEquity.EQUITY_MOVEMENT_ROWS,
        FORM4_ROW_PATTERNS: fileEquity.FORM4_ROW_PATTERNS,
        FORM4_COLUMN_PATTERNS: fileEquity.FORM4_COLUMN_PATTERNS
    };
}

// ─── Cache control ────────────────────────────────────────────────────────────

/**
 * Manually invalidate cache. Called by mappings.controller after publish/delete.
 * Wipes both the global cache entry and ALL user-specific entries for the
 * given reportType, since publishing affects user-specific resolutions too
 * (a user-specific set being published archives the old user-specific set
 * for the overlapping users).
 */
function invalidateCache(reportType) {
    if (!reportType) {
        globalCache.clear();
        return;
    }
    // Delete both the global entry and any `reportType:userId` entries.
    const prefix = `${reportType}:`;
    globalCache.delete(reportType);
    for (const key of globalCache.keys()) {
        if (key.startsWith(prefix)) {
            globalCache.delete(key);
        }
    }
}

module.exports = {
    getBalanceSheetMapping,
    getCashFlowMapping,
    getProfitLossForm2Mapping,
    getEquityMapping,
    invalidateCache
};
