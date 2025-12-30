// processors/balanceSheetProcessor.js

const { readExcelFile } = require('./readers/excelReader');
const { extractBalanceSheetData } = require('./extractors/balanceSheet');
const { transformToIFRSStructure } = require('./transformers/balanceSheetTransformer');
const { styleReport } = require('./utils/excelStyler');

/**
 * Balance Sheet Processor - Modular Architecture
 * Orchestrates the processing pipeline
 */

/**
 * Process balance sheet from file path or buffer
 * @param {string|Buffer} input - File path or buffer
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
        // Step 1: Read Excel file (supports both .xlsx and .xls)
        const normalizedWorkbook = readExcelFile(input);

        if (normalizedWorkbook.sheetCount === 0) {
            throw new Error('No worksheets found in the file');
        }

        const sheet = normalizedWorkbook.sheets[0];

        // Step 2: Extract data from the sheet
        const extracted = extractBalanceSheetData(sheet);

        // Step 3: Transform to IFRS structure
        const ifrsStructure = transformToIFRSStructure(extracted.dataMap);

        // Step 4: Style the output
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

        result.workbook = styleReport(styledData, 'balanceSheet');

        // Update summary
        result.summary.transformations = extracted.dataMap.size;
        result.summary.changes = ifrsStructure.sections.reduce((sum, s) => sum + s.items.length, 0);
        result.summary.originalRows = extracted.dataMap.size;
        result.summary.processedRows = ifrsStructure.sections.reduce((sum, s) => sum + s.items.length, 0);

        return result;

    } catch (error) {
        console.error('[PROCESSOR ERROR]', error.message);
        throw new Error(`Failed to process balance sheet: ${error.message}`);
    }
}

module.exports = {
    processBalanceSheetTemplate
};