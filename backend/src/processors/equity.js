// processors/equity.js
// Orchestrates the Statement of Changes in Equity processing pipeline:
//   readExcelFile → extractEquityData → transformToIFRSEquity → styleEquityReport

'use strict';

const { readExcelFile, pickBestSheet } = require('./readers/excelReader');
const { extractEquityData, scoreEquityCandidate } = require('./extractors/equity');
const { transformToIFRSEquity } = require('./transformers/equity');
const { styleEquityReport } = require('./stylers/equity');

/**
 * Process a Statement of Changes in Equity from either a balance sheet
 * (Form 1) or a dedicated Form 4 file.
 *
 * @param {string|Buffer|ExcelJS.Workbook} input
 * @param {Object} [options]
 * @param {string} [options.userId] - Reserved for future per-user customization
 *
 * NOTE on equity mapping: unlike balance/cashflow/p&l, the equity extractor
 * relies on regex patterns and a structured config that's deeply intertwined
 * with extraction logic. Stage 3b keeps the equity extractor on file constants
 * for safety. Edits in the admin /equity editor are saved to DB and visible
 * there, but transformation still uses src/mappings/equityMapping.js as the
 * source of truth. Switching equity to DB-driven is a separate work item.
 *
 * @returns {Object} { workbook, summary }
 */
async function processEquityTemplate(input, options = {}) {
    // options.userId reserved — see JSDoc above
    const result = {
        workbook: null,
        summary: {
            transformations: 0,
            changes: 0,
            originalRows: 0,
            processedRows: 0,
            worksheets: [],
            warnings: [],
        },
    };

    try {
        // Step 1: Read
        const normalizedWorkbook = await readExcelFile(input);
        if (normalizedWorkbook.sheetCount === 0) {
            throw new Error('No worksheets found in the file');
        }

        const sheet = pickBestSheet(normalizedWorkbook, scoreEquityCandidate, {
            minScore: 3, // either balance-sheet signals OR ≥2 form4 column headers
            label: 'equity statement',
        });
        global.logger.logInfo('[EQUITY PROCESSOR] File read, processing first sheet');

        // Step 2: Extract
        const extracted = extractEquityData(sheet);

        // Step 3: Transform
        const layout = transformToIFRSEquity(extracted);

        // Step 4: Style
        result.workbook = await styleEquityReport(layout);

        // Summary
        result.summary.sourceType = extracted.type;
        result.summary.processedRows = layout.rows.length;
        result.summary.transformations = layout.rows.length;
        result.summary.changes = layout.rows.length;

        if (layout.sourceNote) {
            result.summary.warnings.push(layout.sourceNote);
        }

        // Transformation data for before/after diff view — persisted by controller
        // as sibling JSON.
        result.transformation = buildEquityTransformation(extracted, layout);

        return result;

    } catch (error) {
        global.logger.logError('[EQUITY PROCESSOR ERROR]', error.message);
        throw new Error(`Failed to process equity statement: ${error.message}`);
    }
}

/**
 * Build the transformation JSON payload for an equity statement.
 *
 * Equity is structurally different from the other four templates:
 *   - Categories (Share Capital, Reserves, ...) are COLUMNS, not periods
 *   - Movements (Opening, Net Profit, Closing, ...) are ROWS
 *   - Two distinct source pipelines (balanceSheet vs form4)
 *
 * Source-side payload differs based on `extracted.type`:
 *   - 'balanceSheet': flat list of equity columns with their start/end balances
 *   - 'form4'        : matrix of {movement, column} → value (same shape as target)
 *
 * Target-side is always the matrix layout produced by the transformer.
 */
function buildEquityTransformation(extracted, layout) {
    const columns = layout.columns || [];

    // ── Source side ──────────────────────────────────────────────────────────
    let source;

    if (extracted.type === 'balanceSheet') {
        // Source has only opening/closing per equity column
        const equityRows = [];
        for (const col of columns) {
            if (col.isCalculated) continue; // skip computed Total column
            const entry = extracted.equityData?.[col.key] || { start: 0, end: 0 };
            equityRows.push({
                columnKey: col.key,
                label: col.label,
                start: typeof entry.start === 'number' ? entry.start : 0,
                end: typeof entry.end === 'number' ? entry.end : 0,
            });
        }
        source = {
            sourceType: 'balanceSheet',
            companyName: extracted.companyName || '',
            reportDate: extracted.reportDate || '',
            equityRows,
        };
    } else {
        // Form 4 source — full movement matrix
        const { movements } = extracted;
        const movementRows = [];
        // Use EQUITY_MOVEMENT_ROWS for canonical order/labels
        const { EQUITY_MOVEMENT_ROWS } = require('../mappings/equityMapping');

        for (const movDef of EQUITY_MOVEMENT_ROWS) {
            const movData = movements?.[movDef.key];
            if (!movData) continue;

            // Skip rows with all null/zero unless they're declared totals
            const hasData = columns.some(col => {
                if (col.isCalculated) return false;
                const v = movData[col.key];
                return v != null && v !== 0;
            });
            if (!hasData && !movDef.isTotal) continue;

            const values = {};
            columns.forEach(col => {
                if (col.isCalculated) return;
                values[col.key] = typeof movData[col.key] === 'number' ? movData[col.key] : 0;
            });

            movementRows.push({
                key: movDef.key,
                label: movDef.label,
                isTotal: movDef.isTotal === true,
                values,
            });
        }

        source = {
            sourceType: 'form4',
            companyName: extracted.companyName || '',
            movementRows,
        };
    }

    // ── Target side ──────────────────────────────────────────────────────────
    const targetColumns = columns.map(c => ({
        key: c.key,
        label: c.label,
        isCalculated: c.isCalculated === true,
        isNegative: c.isNegative === true,
    }));

    const targetRows = (layout.rows || []).map(r => ({
        key: r.key,
        label: r.label || '',
        isTotal: r.isTotal === true,
        values: { ...(r.values || {}) },
    }));

    return {
        version: 1,
        template: 'equity',
        generatedAt: new Date().toISOString(),
        source,
        target: {
            title: 'STATEMENT OF CHANGES IN EQUITY (IFRS)',
            companyName: layout.companyName || '',
            sourceType: layout.sourceType,
            sourceNote: layout.sourceNote || null,
            columns: targetColumns,
            rows: targetRows,
        },
    };
}

module.exports = { processEquityTemplate };