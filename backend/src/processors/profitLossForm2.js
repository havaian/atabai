// processors/profitLossForm2.js
// Orchestrates the standard NSBU Form 2 P&L processing pipeline:
//   readExcelFile → extractProfitLossForm2Data → transformForm2ToIFRS → styleProfitLossReport

'use strict';

const { readExcelFile } = require('./readers/excelReader');
const { extractProfitLossForm2Data } = require('./extractors/profitLossForm2');
const { transformForm2ToIFRS } = require('./transformers/profitLossForm2');
const { styleProfitLossReport } = require('./stylers/profitLoss');

/**
 * Process a standard NSBU Form 2 P&L statement.
 *
 * @param {string|Buffer|ExcelJS.Workbook} input
 * @returns {Object} { workbook, summary }
 */
async function processProfitLossForm2Template(input) {
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

        const sheet = normalizedWorkbook.sheets[0];
        global.logger.logInfo('[PL-F2 PROCESSOR] File read, processing first sheet');

        // Step 2: Extract (Form 2 row-code-based extractor)
        const extracted = extractProfitLossForm2Data(sheet);

        // Step 3: Transform
        const ifrsLayout = transformForm2ToIFRS(extracted);

        // Step 4: Style (reuse the same P&L styler)
        const styledData = {
            title: 'PROFIT & LOSS STATEMENT (IFRS) — Form 2',
            companyName: extracted.metadata.companyName || '',
            periods: ifrsLayout.periods,
            rows: ifrsLayout.rows,
            namedRefs: ifrsLayout.namedRefs,
        };

        result.workbook = await styleProfitLossReport(styledData);

        result.summary.transformations = Object.keys(extracted.dataMap).length;
        result.summary.changes = ifrsLayout.rows.filter(r => r.type === 'item').length;
        result.summary.originalRows = Object.keys(extracted.dataMap).length;
        result.summary.processedRows = ifrsLayout.rows.length;

        return result;

    } catch (error) {
        global.logger.logError('[PL-F2 PROCESSOR ERROR]', error.message);
        throw new Error(`Failed to process Form 2 P&L statement: ${error.message}`);
    }
}

module.exports = { processProfitLossForm2Template };