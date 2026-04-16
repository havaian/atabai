// processors/balanceSheet.js

const { readExcelFile, pickBestSheet } = require('./readers/excelReader');
const { extractBalanceSheetData, scoreBalanceSheetCandidate } = require('./extractors/balanceSheet');
const { transformToIFRSStructure } = require('./transformers/balanceSheet');
const { styleReport } = require('./stylers/balanceSheet');

/**
 * Balance Sheet Processor - Modular Architecture
 * Orchestrates the processing pipeline
 */

/**
 * Process balance sheet from file path, buffer, or ExcelJS Workbook
 * @param {string|Buffer|ExcelJS.Workbook} input - File path, buffer, or ExcelJS Workbook
 * @returns {Object} Processing result with workbook and summary
 */
async function processBalanceSheetTemplate(input) {
    const result = {
        workbook: null,
        summary: {
            transformations: 0,
            changes: 0,
            originalRows: 0,
            processedRows: 0,
            worksheets: [],
            warnings: []
        }
    };

    try {
        // Step 1: Read Excel file (supports .xlsx, .xls, and ExcelJS Workbook)
        const normalizedWorkbook = await readExcelFile(input);

        if (normalizedWorkbook.sheetCount === 0) {
            throw new Error('No worksheets found in the file');
        }

        // Select the best-matching sheet (handles multi-sheet NSBU exports where
        // sheet 0 is a cover page and the actual balance is on a later sheet).
        const sheet = pickBestSheet(normalizedWorkbook, scoreBalanceSheetCandidate, {
            minScore: 6, // must clear at least code-header (3) + aktiv-marker (3)
            label: 'balance sheet',
        });

        // Step 2: Extract data from the sheet
        const extracted = extractBalanceSheetData(sheet);

        // Step 3: Transform to IFRS structure
        const ifrsStructure = transformToIFRSStructure(extracted.dataMap);

        // Step 4: Style the output (now async due to logo loading)
        const styledData = {
            title: 'STATEMENT OF FINANCIAL POSITION (IFRS)',
            companyName: extracted.metadata.companyName,
            reportDate: extracted.metadata.reportDate,
            inn: extracted.metadata.inn,
            sections: ifrsStructure.sections,
            totalAssetsStart: ifrsStructure.totalAssetsStart,
            totalAssetsEnd: ifrsStructure.totalAssetsEnd,
            totalEquityLiabStart: ifrsStructure.totalEquityLiabStart,
            totalEquityLiabEnd: ifrsStructure.totalEquityLiabEnd
        };

        result.workbook = await styleReport(styledData, 'balanceSheet');

        // Update summary
        result.summary.transformations = extracted.dataMap.size;
        result.summary.changes = ifrsStructure.sections.reduce((sum, s) => sum + s.items.length, 0);
        result.summary.originalRows = extracted.dataMap.size;
        result.summary.processedRows = ifrsStructure.sections.reduce((sum, s) => sum + s.items.length, 0);

        return result;

    } catch (error) {
        global.logger.logError('[PROCESSOR ERROR]', error.message);
        throw new Error(`Failed to process balance sheet: ${error.message}`);
    }
}

module.exports = {
    processBalanceSheetTemplate
};