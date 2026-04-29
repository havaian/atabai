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

        // Transformation data for before/after diff view — persisted by controller
        // as sibling JSON.
        result.transformation = buildCashFlowTransformation(extracted, ifrsStructure, styledData);

        return result;

    } catch (error) {
        global.logger.logError('[CASH FLOW PROCESSOR ERROR]', error.message);
        throw new Error(`Failed to process cash flow statement: ${error.message}`);
    }
}

/**
 * Build the transformation JSON payload for a cash flow statement.
 *
 * Source-side: cashFlow extractor uses synthetic keys (section_subsection_label_counter)
 * not NSBU codes, so we can't join with the CASH_FLOW_MAPPING at read time. The
 * `section` field on each row IS the classification.
 *
 * Target-side: IFRS sections with periodValues per item, plus pre-computed
 * section totals (operatingTotal, investingTotal, financingTotal) and the
 * derived CF/FCF summary sections (already in ifrsStructure.sections).
 */
function buildCashFlowTransformation(extracted, ifrsStructure, styledData) {
    const periods = ifrsStructure.periods || [];

    // ── Source side ──────────────────────────────────────────────────────────
    // Flatten dataMap entries (synthetic keys discarded — we use the data only)
    const sourceRows = [];
    for (const [, data] of extracted.dataMap.entries()) {
        sourceRows.push({
            lineItem: data.lineItem || '',
            section: data.section || '',
            subSection: data.subSection || null,
            periodValues: Array.isArray(data.periodValues)
                ? data.periodValues.map(v => v == null ? null : Number(v))
                : new Array(periods.length).fill(null),
            total: typeof data.total === 'number' ? data.total : 0,
        });
    }
    // Keep extraction order — meaningful for the source file's natural row sequence

    // Reconciliation items (separate map in extractor)
    const reconciliationRows = [];
    if (extracted.reconciliationItems && extracted.reconciliationItems.size > 0) {
        for (const [, data] of extracted.reconciliationItems.entries()) {
            reconciliationRows.push({
                lineItem: data.lineItem || '',
                periodValues: Array.isArray(data.periodValues)
                    ? data.periodValues.map(v => v == null ? null : Number(v))
                    : new Array(periods.length).fill(null),
                total: typeof data.total === 'number' ? data.total : 0,
            });
        }
    }

    // Additional sources items (separate map)
    const additionalSourcesRows = [];
    if (extracted.additionalSourcesItems && extracted.additionalSourcesItems.size > 0) {
        for (const [, data] of extracted.additionalSourcesItems.entries()) {
            additionalSourcesRows.push({
                lineItem: data.lineItem || '',
                periodValues: Array.isArray(data.periodValues)
                    ? data.periodValues.map(v => v == null ? null : Number(v))
                    : new Array(periods.length).fill(null),
                total: typeof data.total === 'number' ? data.total : 0,
                isCategory: data.isCategory === true,
            });
        }
    }

    // ── Target side ──────────────────────────────────────────────────────────
    // Sections already include the CF/FCF summary sections (isSummary: true)
    // and conditionally ADDITIONAL SOURCES. Strip internal-only fields.
    const targetSections = (ifrsStructure.sections || []).map(section => ({
        name: section.name,
        isSummary: section.isSummary === true,
        items: (section.items || []).map(it => ({
            label: it.label || '',
            periodValues: Array.isArray(it.periodValues)
                ? it.periodValues.map(v => v == null ? 0 : Number(v))
                : new Array(periods.length).fill(0),
            total: typeof it.total === 'number' ? it.total : 0,
            flowType: it.flowType || null,
            indent: it.indent || 1,
            isSubItem: it.isSubItem === true,
            isCategory: it.isCategory === true,
        })),
    }));

    return {
        version: 1,
        template: 'cashFlow',
        generatedAt: new Date().toISOString(),
        source: {
            metadata: {
                companyName: extracted.metadata?.companyName || '',
                period: extracted.metadata?.period || '',
                inn: extracted.metadata?.inn || '',
            },
            periods,
            rows: sourceRows,
            reconciliationRows,
            additionalSourcesRows,
        },
        target: {
            title: styledData.title,
            periods,
            sections: targetSections,
            operatingTotal: ifrsStructure.operatingTotal,
            investingTotal: ifrsStructure.investingTotal,
            financingTotal: ifrsStructure.financingTotal,
            cfTotal: ifrsStructure.cfTotal,
            fcfTotal: ifrsStructure.fcfTotal,
        },
    };
}

module.exports = {
    processCashFlowTemplate
};