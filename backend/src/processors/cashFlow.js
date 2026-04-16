// processors/cashFlow.js - FINAL: Updated to work with simplified extractor/transformer

const { readExcelFile, pickBestSheet } = require('./readers/excelReader');
const { extractCashFlowData, scoreCashFlowCandidate } = require('./extractors/cashFlow');
const { transformToIFRSCashFlow } = require('./transformers/cashFlow');
const { styleCashFlowReport } = require('./stylers/cashFlow');

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
        const normalizedWorkbook = await readExcelFile(input);

        if (normalizedWorkbook.sheetCount === 0) {
            throw new Error('No worksheets found in the file');
        }

        const sheet = pickBestSheet(normalizedWorkbook, scoreCashFlowCandidate, {
            minScore: 8, // at least 2 of the 3 main sections detected
            label: 'cash flow statement',
        });

        // Extract (returns dataMap, periods, reconciliationItems, additionalSourcesItems)
        const extracted = extractCashFlowData(sheet);

        // BUG-006 FIX: pass reconciliationItems and additionalSourcesItems to transformer.
        // Previously called with only 2 args, leaving reconciliation always undefined.
        const ifrsStructure = transformToIFRSCashFlow(
            extracted.dataMap,
            extracted.periods,
            extracted.reconciliationItems,
            extracted.additionalSourcesItems
        );

        // Style
        const styledData = {
            title: 'STATEMENT OF CASH FLOWS (IFRS)',
            companyName: extracted.metadata.companyName,
            period: extracted.metadata.period || 'For the period ended',
            inn: extracted.metadata.inn,
            periods: ifrsStructure.periods,
            sections: ifrsStructure.sections,
            operatingTotal: ifrsStructure.operatingTotal,
            investingTotal: ifrsStructure.investingTotal,
            financingTotal: ifrsStructure.financingTotal
        };

        result.workbook = await styleCashFlowReport(styledData);

        result.summary.transformations = extracted.dataMap.size;
        result.summary.changes = ifrsStructure.sections.reduce((sum, s) => sum + s.items.length, 0);
        result.summary.originalRows = extracted.dataMap.size;
        result.summary.processedRows = ifrsStructure.sections.reduce((sum, s) => sum + s.items.length, 0);

        return result;

    } catch (error) {
        global.logger.logError('[CASH FLOW PROCESSOR ERROR]', error.message);
        throw new Error(`Failed to process cash flow statement: ${error.message}`);
    }
}

module.exports = {
    processCashFlowTemplate
};