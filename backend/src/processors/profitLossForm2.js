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

const { readExcelFile, pickBestSheet } = require('./readers/excelReader');
const { extractProfitLossForm2Data, isForm2, scoreForm2PLCandidate } = require('./extractors/profitLossForm2');
const { extractProfitLossData, scoreBudgetPLCandidate } = require('./extractors/profitLoss');
const { transformForm2ToIFRS } = require('./transformers/profitLossForm2');
const { transformToIFRSProfitLoss } = require('./transformers/profitLoss');
const { styleProfitLossReport } = require('./stylers/profitLoss');
const { getProfitLossForm2Mapping } = require('../services/mappingResolver');

/**
 * Process a P&L statement submitted under the "profitLossForm2" template.
 *
 * @param {string|Buffer|ExcelJS.Workbook} input
 * @param {Object} [options]
 * @param {string} [options.userId] - If a user-specific published MappingSet
 *     exists for this user (see MappingSet.assignedUsers), use it; otherwise
 *     fall back to the global mapping.
 * @returns {Object} { workbook, summary }
 */
async function processProfitLossForm2Template(input, options = {}) {
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
        // Resolve mapping (DB with file fallback; per-user MappingSet
        // assignment applied if any).
        const mapping = await getProfitLossForm2Mapping(options.userId);
        // Calculated codes are derived from the mapping itself
        const calculatedCodes = new Set(
            Object.entries(mapping)
                .filter(([, def]) => def.isCalculated)
                .map(([code]) => code)
        );

        // Step 1: Read
        const normalizedWorkbook = await readExcelFile(input);
        if (normalizedWorkbook.sheetCount === 0) {
            throw new Error('No worksheets found in the file');
        }

        const combinedScorer = (sheet) => Math.max(
            scoreForm2PLCandidate(sheet),
            scoreBudgetPLCandidate(sheet)
        );
        const sheet = pickBestSheet(normalizedWorkbook, combinedScorer, {
            minScore: 6,
            label: 'P&L statement',
        });

        // Step 2: Detect actual format
        const isStandardForm2 = isForm2(sheet);
        global.logger.logInfo(`[PL-F2 PROCESSOR] Format detected: ${isStandardForm2 ? 'NSBU Form 2 (row-code)' : 'Construction budget P&L (budget format)'}`);

        let extracted, ifrsLayout, styledData;

        if (isStandardForm2) {
            // ── Genuine NSBU Form 2 (ОКУД 0710002) pipeline ──────────────────
            extracted = extractProfitLossForm2Data(sheet, mapping, calculatedCodes);
            ifrsLayout = transformForm2ToIFRS(extracted, mapping);

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