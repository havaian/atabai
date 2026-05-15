/**
 * Mapping seed — populates the database with the initial set of mappings
 * from the hardcoded files in src/mappings/.
 *
 * Behavior:
 *   - For each report type that has NO published MappingSet, creates one
 *     by copying the contents of the corresponding mappings/*.js file.
 *   - Idempotent: if a published set already exists for a report type,
 *     that report type is skipped.
 *   - Files in src/mappings/ remain on disk as backup/reset source.
 *
 * Called:
 *   - Automatically at server startup (best-effort; failures logged but
 *     do not block startup)
 *   - Manually via POST /api/admin/mappings/seed (super_admin only)
 */

const MappingSet = require('./models/mappingSet.model');
const RowMapping = require('./models/rowMapping.model');
const EquityMappingConfig = require('./models/equityMappingConfig.model');

const { BALANCE_SHEET_MAPPING } = require('../mappings/accountMapping');
const { CASH_FLOW_MAPPING } = require('../mappings/cashFlowMapping');
const { FORM2_ROW_CODES } = require('../mappings/profitLossForm2Mapping');
const {
    EQUITY_COLUMNS,
    BS_ROW_TO_EQUITY_COLUMN,
    EQUITY_MOVEMENT_ROWS,
    FORM4_ROW_PATTERNS,
    FORM4_COLUMN_PATTERNS
} = require('../mappings/equityMapping');

/**
 * Seed a single row-based report type. Returns number of rows created.
 * @param {string} reportType
 * @param {Object} sourceMap   keyed by nsbuRowCode
 * @param {Object} userId      ObjectId of seeding user (system if absent)
 * @returns {Promise<{ created: boolean, rowCount: number, mappingSetId: ?string }>}
 */
async function seedRowBased(reportType, sourceMap, userId) {
    const existing = await MappingSet.findOne({ reportType, status: 'published' });
    if (existing) {
        return { created: false, rowCount: 0, mappingSetId: existing._id.toString() };
    }

    const set = await MappingSet.create({
        reportType,
        version: 1,
        status: 'published',
        publishedAt: new Date(),
        publishedBy: userId || null,
        createdBy: userId || null,
        notes: 'Initial seed from src/mappings/'
    });

    const rows = Object.entries(sourceMap).map(([nsbuRowCode, def]) => ({
        mappingSetId: set._id,
        nsbuRowCode,
        nsbuCodes: def.nsbuCodes || [],
        nsbuDescription: def.nsbuDescription || def.label || '',
        ifrsClassification: def.ifrsClassification || def.label || '',
        section: def.section || '',
        subsection: def.subsection || '',
        isNegative: !!def.isNegative,
        isCalculated: !!def.isCalculated,
        formula: def.formula || null,
        flowType: def.flowType || null,
        directMethod: typeof def.directMethod === 'boolean' ? def.directMethod : null,
        netCalculation: typeof def.netCalculation === 'boolean' ? def.netCalculation : null,
        plSection: def.section && reportType === 'profit_loss_form2' ? def.section : null,
        label: def.label || '',
        accountDetails: def.accountDetails || null,
        notes: ''
    }));

    if (rows.length > 0) {
        await RowMapping.insertMany(rows, { ordered: false });
    }

    return { created: true, rowCount: rows.length, mappingSetId: set._id.toString() };
}

/**
 * Seed equity mapping (special schema).
 */
async function seedEquity(userId) {
    const existing = await MappingSet.findOne({ reportType: 'equity', status: 'published' });
    if (existing) {
        return { created: false, mappingSetId: existing._id.toString() };
    }

    const set = await MappingSet.create({
        reportType: 'equity',
        version: 1,
        status: 'published',
        publishedAt: new Date(),
        publishedBy: userId || null,
        createdBy: userId || null,
        notes: 'Initial seed from src/mappings/equityMapping.js'
    });

    await EquityMappingConfig.create({
        mappingSetId: set._id,
        columns: EQUITY_COLUMNS.map(col => ({
            key: col.key,
            label: col.label,
            nsbuRows: col.nsbuRows || [],
            isNegative: !!col.isNegative,
            isCalculated: !!col.isCalculated
        })),
        bsRowToEquityColumn: new Map(Object.entries(BS_ROW_TO_EQUITY_COLUMN)),
        movementRows: EQUITY_MOVEMENT_ROWS.map(r => ({
            key: r.key,
            label: r.label,
            isTotal: !!r.isTotal
        })),
        rowPatterns: FORM4_ROW_PATTERNS.map(p => ({
            key: p.key,
            pattern: p.pattern.source,
            flags: p.pattern.flags || 'i'
        })),
        columnPatterns: FORM4_COLUMN_PATTERNS.map(p => ({
            key: p.key,
            pattern: p.pattern.source,
            flags: p.pattern.flags || 'i'
        })),
        notes: ''
    });

    return { created: true, mappingSetId: set._id.toString() };
}

/**
 * Run full seed.
 * @param {Object} options
 * @param {string} options.userId  ObjectId of seeding user (optional)
 * @returns {Promise<Object>}
 */
async function runSeed({ userId } = {}) {
    const results = {};

    results.balance_sheet = await seedRowBased('balance_sheet', BALANCE_SHEET_MAPPING, userId);
    results.cash_flow = await seedRowBased('cash_flow', CASH_FLOW_MAPPING, userId);
    results.profit_loss_form2 = await seedRowBased('profit_loss_form2', FORM2_ROW_CODES, userId);
    results.equity = await seedEquity(userId);

    return results;
}

/**
 * Idempotent best-effort seed run at startup. Errors are logged but not thrown
 * so they cannot block the server from starting.
 */
async function runSeedAtStartup() {
    try {
        const results = await runSeed({ userId: null });
        const createdTypes = Object.entries(results)
            .filter(([, r]) => r.created)
            .map(([t]) => t);
        if (createdTypes.length > 0) {
            global.logger.logInfo(`Mapping seed created sets for: ${createdTypes.join(', ')}`, {
                category: 'startup'
            });
        }
    } catch (error) {
        global.logger.logError(error, { context: 'mappingSeed.runSeedAtStartup' });
    }
}

module.exports = {
    runSeed,
    runSeedAtStartup,
    seedRowBased,
    seedEquity
};
