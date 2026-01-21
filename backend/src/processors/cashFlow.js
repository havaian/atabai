// processors/cashFlow.js - WITH ADDITIONAL SOURCES SUPPORT

const { readExcelFile } = require('./readers/excelReader');
const { extractCashFlowData } = require('./extractors/cashFlow');
const { transformToIFRSCashFlow } = require('./transformers/cashFlow');
const { styleCashFlowReport } = require('../utils/stylers/cashFlow');

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

        const sheet = normalizedWorkbook.sheets[0];

        // Extract (now includes additionalSourcesItems)
        const extracted = extractCashFlowData(sheet);

        // Transform (now accepts additionalSourcesItems)
        const ifrsStructure = transformToIFRSCashFlow(
            extracted.dataMap,
            extracted.periods,
            extracted.reconciliationItems,
            extracted.additionalSourcesItems  // NEW
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
            financingTotal: ifrsStructure.financingTotal,
            additionalSourcesTotal: ifrsStructure.additionalSourcesTotal,  // NEW
            netChange: ifrsStructure.netChange,
            reconciliation: ifrsStructure.reconciliation,  // Pass reconciliation items (FCF only)
            fxEffects: ifrsStructure.fxEffects,
            cashBeginning: ifrsStructure.cashBeginning,
            cashEnding: ifrsStructure.cashEnding
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