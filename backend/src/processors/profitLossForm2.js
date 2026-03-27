// processors/profitLossForm2.js
// Orchestrates the standard NSBU Form 2 P&L processing pipeline:
//   readExcelFile → extractProfitLossForm2Data → transformForm2ToIFRS → styleProfitLossReport
//
// Auto-detects the actual file format using isForm2():
//   - If the sheet contains ≥3 standard NSBU row codes (010, 020, …) → genuine Form 2 pipeline
//   - Otherwise (construction budget P&L, same genre as PL_1) → PL_1 budget pipeline
//
// Both paths emit the same layout descriptor shape, so the same styler handles both.

'use strict';

const { readExcelFile } = require('./readers/excelReader');
const { extractProfitLossForm2Data, isForm2 } = require('./extractors/profitLossForm2');
const { transformForm2ToIFRS } = require('./transformers/profitLossForm2');
const { extractProfitLossData } = require('./extractors/profitLoss');
const { transformToIFRSProfitLoss } = require('./transformers/profitLoss');
const { styleProfitLossReport } = require('./stylers/profitLoss');

/**
 * Process a P&L statement submitted under the "profitLossForm2" template.
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

        // Step 2: Detect actual format
        const isStandardForm2 = isForm2(sheet);
        global.logger.logInfo(`[PL-F2 PROCESSOR] Format detected: ${isStandardForm2 ? 'NSBU Form 2 (row-code)' : 'Construction budget P&L (budget format)'}`);

        let extracted, ifrsLayout, styledData;

        if (isStandardForm2) {
            // ── Genuine NSBU Form 2 (ОКУД 0710002) pipeline ──────────────────
            extracted = extractProfitLossForm2Data(sheet);
            ifrsLayout = transformForm2ToIFRS(extracted);

            styledData = {
                title: 'PROFIT & LOSS STATEMENT (IFRS) — Form 2',
                companyName: extracted.metadata.companyName || '',
                periods: ifrsLayout.periods,
                rows: ifrsLayout.rows,
                namedRefs: ifrsLayout.namedRefs,
            };

            result.summary.transformations = Object.keys(extracted.dataMap).length;
            result.summary.originalRows = Object.keys(extracted.dataMap).length;

        } else {
            // ── Construction budget P&L pipeline (same as profitLoss template) ──
            // Files like PL_2.xlsx use Russian keyword section markers (ДОХОДЫ,
            // РАСХОДЫ, Накладные проекта, etc.) instead of numeric row codes.
            // The budget P&L extractor handles these correctly.
            extracted = extractProfitLossData(sheet);
            ifrsLayout = transformToIFRSProfitLoss(extracted);

            styledData = {
                title: 'PROFIT & LOSS STATEMENT (IFRS)',
                companyName: extracted.metadata.companyName || '',
                periods: ifrsLayout.periods,
                rows: ifrsLayout.rows,
                namedRefs: ifrsLayout.namedRefs,
            };

            result.summary.transformations = extracted.revenueItems.length + extracted.cogsItems.length;
            result.summary.originalRows = extracted.revenueItems.length + extracted.cogsItems.length;
        }

        // Step 3: Style (same styler for both paths)
        result.workbook = await styleProfitLossReport(styledData);

        result.summary.changes = ifrsLayout.rows.filter(r => r.type === 'item').length;
        result.summary.processedRows = ifrsLayout.rows.length;

        return result;

    } catch (error) {
        global.logger.logError('[PL-F2 PROCESSOR ERROR]', error.message);
        throw new Error(`Failed to process Form 2 P&L statement: ${error.message}`);
    }
}

module.exports = { processProfitLossForm2Template };