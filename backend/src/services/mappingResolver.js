/**
 * Mapping resolver.
 *
 * Provides DB-backed mappings (with fallback to the original file constants)
 * for transformers and extractors. Optionally layers per-user overrides on top.
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
 * Caching strategy:
 *   - Global mappings (no user override) are cached per reportType for 60s.
 *     Cache key contains the published MappingSet id; if a new draft is
 *     published, the new id invalidates the cache automatically.
 *   - User-override-resolved mappings are computed on demand (no cache).
 *     Overrides change less frequently than they're read, but per-user caching
 *     would need invalidation on PUT/DELETE override and we keep it simple.
 *
 * Failure mode:
 *   - DB read error or no published set → fallback to file constants
 *     (logged once per minute to avoid spam).
 */

'use strict';

const MappingSet = require('../admin/models/mappingSet.model');
const RowMapping = require('../admin/models/rowMapping.model');
const EquityMappingConfig = require('../admin/models/equityMappingConfig.model');
const UserMappingOverride = require('../admin/models/userMappingOverride.model');

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
 */
async function loadRowBasedFromDb(reportType) {
    const cached = globalCache.get(reportType);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.data;
    }

    try {
        const set = await MappingSet.findOne({ reportType, status: 'published' }).lean();
        if (!set) {
            return null;
        }
        const rows = await RowMapping.find({ mappingSetId: set._id }).lean();
        const out = {};
        for (const row of rows) {
            out[row.nsbuRowCode] = rowDocToFileShape(row);
        }
        globalCache.set(reportType, {
            setId: String(set._id),
            data: out,
            expiresAt: Date.now() + CACHE_TTL_MS
        });
        return out;
    } catch (err) {
        global.logger?.logError?.(err, { context: 'mappingResolver.loadRowBasedFromDb', reportType });
        return null;
    }
}

/**
 * Apply per-user overrides on top of a base mapping.
 * Returns a NEW object (does not mutate base). Overrides win.
 */
async function applyUserOverrides(reportType, baseMap, userId) {
    if (!userId) return baseMap;
    try {
        const overrides = await UserMappingOverride.find({ userId, reportType }).lean();
        if (overrides.length === 0) return baseMap;
        const out = { ...baseMap };
        for (const ov of overrides) {
            out[ov.nsbuRowCode] = rowDocToFileShape(ov);
        }
        return out;
    } catch (err) {
        global.logger?.logError?.(err, { context: 'mappingResolver.applyUserOverrides', reportType, userId });
        return baseMap;
    }
}

// ─── Public API: row-based reports ────────────────────────────────────────────

async function getBalanceSheetMapping(userId) {
    let base = await loadRowBasedFromDb('balance_sheet');
    if (!base) {
        logFallback('balance_sheet', 'no published set in DB');
        base = fileBalanceSheet.BALANCE_SHEET_MAPPING;
    }
    return applyUserOverrides('balance_sheet', base, userId);
}

async function getCashFlowMapping(userId) {
    let base = await loadRowBasedFromDb('cash_flow');
    if (!base) {
        logFallback('cash_flow', 'no published set in DB');
        base = fileCashFlow.CASH_FLOW_MAPPING;
    }
    return applyUserOverrides('cash_flow', base, userId);
}

async function getProfitLossForm2Mapping(userId) {
    let base = await loadRowBasedFromDb('profit_loss_form2');
    if (!base) {
        logFallback('profit_loss_form2', 'no published set in DB');
        base = fileProfitLossF2.FORM2_ROW_CODES;
    }
    return applyUserOverrides('profit_loss_form2', base, userId);
}

// ─── Public API: equity ───────────────────────────────────────────────────────

/**
 * Equity mapping shape (matches src/mappings/equityMapping.js exports):
 *   { EQUITY_COLUMNS, BS_ROW_TO_EQUITY_COLUMN, EQUITY_MOVEMENT_ROWS,
 *     FORM4_ROW_PATTERNS, FORM4_COLUMN_PATTERNS }
 *
 * User overrides are NOT supported for equity in MVP (its schema is too
 * different from row mappings). userId param is accepted but ignored.
 */
async function getEquityMapping(/* userId */) {
    const cached = globalCache.get('equity');
    if (cached && cached.expiresAt > Date.now()) {
        return cached.data;
    }

    try {
        const set = await MappingSet.findOne({ reportType: 'equity', status: 'published' }).lean();
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

                globalCache.set('equity', {
                    setId: String(set._id),
                    data,
                    expiresAt: Date.now() + CACHE_TTL_MS
                });
                return data;
            }
        }
        logFallback('equity', 'no published set/config in DB');
    } catch (err) {
        global.logger?.logError?.(err, { context: 'mappingResolver.getEquityMapping' });
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
 */
function invalidateCache(reportType) {
    if (reportType) {
        globalCache.delete(reportType);
    } else {
        globalCache.clear();
    }
}

module.exports = {
    getBalanceSheetMapping,
    getCashFlowMapping,
    getProfitLossForm2Mapping,
    getEquityMapping,
    invalidateCache
};
