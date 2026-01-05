// processors/cashFlow.js

const { readExcelFile } = require('./readers/excelReader');
const { extractCashFlowData } = require('./extractors/cashFlow');
const { transformToIFRSCashFlow } = require('./transformers/cashFlow');
const { styleCashFlowReport } = require('../utils/stylers/cashFlow');

/**
 * Cash Flow Processor - Modular Architecture
 * Orchestrates the processing pipeline for cash flow statements
 */

/**
 * Process cash flow from file path, buffer, or ExcelJS Workbook
 * @param {string|Buffer|ExcelJS.Workbook} input - File path, buffer, or ExcelJS Workbook
 * @returns {Object} Processing result with workbook and summary
 */
async function processCashFlowTemplate(input) {
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

        const sheet = normalizedWorkbook.sheets[0];

        // Step 2: Extract data from the sheet
        const extracted = extractCashFlowData(sheet);

        // Step 3: Transform to IFRS structure
        const ifrsStructure = transformToIFRSCashFlow(extracted.dataMap);

        // Step 4: Style the output
        const styledData = {
            title: 'STATEMENT OF CASH FLOWS (IFRS)',
            companyName: extracted.metadata.companyName,
            period: extracted.metadata.period || 'For the period ended',
            inn: extracted.metadata.inn,
            sections: ifrsStructure.sections,
            operatingTotal: ifrsStructure.operatingTotal,
            investingTotal: ifrsStructure.investingTotal,
            financingTotal: ifrsStructure.financingTotal,
            netChange: ifrsStructure.netChange,
            fxEffects: ifrsStructure.fxEffects,
            cashBeginning: ifrsStructure.cashBeginning,
            cashEnding: ifrsStructure.cashEnding
        };

        result.workbook = styleCashFlowReport(styledData);

        // Update summary
        result.summary.transformations = extracted.dataMap.size;
        result.summary.changes = ifrsStructure.sections.reduce((sum, s) => sum + s.items.length, 0);
        result.summary.originalRows = extracted.dataMap.size;
        result.summary.processedRows = ifrsStructure.sections.reduce((sum, s) => sum + s.items.length, 0);

        return result;

    } catch (error) {
        console.error('[CASH FLOW PROCESSOR ERROR]', error.message);
        throw new Error(`Failed to process cash flow statement: ${error.message}`);
    }
}

module.exports = {
    processCashFlowTemplate
};