// processors/profitLoss.js
// Orchestrates the P&L processing pipeline:
//   readExcelFile → extractor → transformer → styler

'use strict';

const { readExcelFile } = require('./readers/excelReader');
const { extractProfitLossData } = require('./extractors/profitLoss');
const { transformToIFRSProfitLoss } = require('./transformers/profitLoss');
const { styleProfitLossReport } = require('../utils/stylers/profitLoss');

/**
 * Process a Profit & Loss report from NSBU format to IFRS format.
 *
 * @param {string|Buffer|ExcelJS.Workbook} input - File path, buffer, or workbook
 * @returns {Object} { workbook, summary }
 */
async function processProfitLossTemplate(input) {
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
        // ── Step 1: Read ──────────────────────────────────────────────────────
        const normalizedWorkbook = await readExcelFile(input);

        if (normalizedWorkbook.sheetCount === 0) {
            throw new Error('No worksheets found in the file');
        }

        const sheet = normalizedWorkbook.sheets[0];
        global.logger.logInfo('[PL PROCESSOR] File read, processing first sheet');

        // ── Step 2: Extract ───────────────────────────────────────────────────
        const extracted = extractProfitLossData(sheet);

        // ── Step 3: Transform ─────────────────────────────────────────────────
        const ifrsLayout = transformToIFRSProfitLoss(extracted);

        // ── Step 4: Style ─────────────────────────────────────────────────────
        const styledData = {
            title: 'PROFIT & LOSS STATEMENT (IFRS)',
            companyName: extracted.metadata.companyName || '',
            periods: ifrsLayout.periods,
            rows: ifrsLayout.rows,
            namedRefs: ifrsLayout.namedRefs,
        };

        result.workbook = await styleProfitLossReport(styledData);

        // ── Summary ───────────────────────────────────────────────────────────
        result.summary.transformations = extracted.revenueItems.length + extracted.cogsItems.length;
        result.summary.changes = ifrsLayout.rows.filter((r) => r.type === 'item').length;
        result.summary.originalRows = extracted.revenueItems.length + extracted.cogsItems.length;
        result.summary.processedRows = ifrsLayout.rows.length;
        result.summary.worksheets = ['IFRS P&L Statement'];

        global.logger.logInfo('[PL PROCESSOR] Processing complete');
        return result;

    } catch (error) {
        global.logger.logError('[PL PROCESSOR] Error:', error.message);
        throw new Error(`Failed to process P&L statement: ${error.message}`);
    }
}

module.exports = { processProfitLossTemplate };