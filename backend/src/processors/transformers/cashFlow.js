// transformers/cashFlow.js

// ─── NSBU → IFRS label translation map ───────────────────────────────────────
// Covers all line-item labels observed in NSBU cash flow budget files.
// Keys are trimmed Russian source labels (case-sensitive match attempted first,
// then lowercased fallback). Unmatched labels are passed through unchanged so
// that future NSBU variants don't silently break.
const LABEL_MAP = {
    // Operating — inflows
    'Реализация продукции и товаров': 'Product & goods sales receipts',
    'Реализация услуг': 'Service revenue receipts',
    'Прочая выручка': 'Other revenue receipts',
    'Авансы полученные': 'Customer advances received',
    'Прочие поступления': 'Other operating receipts',

    // Operating — outflows
    'Платежи поставщикам за товары и услуги': 'Payments to suppliers',
    'Авансы выданные': 'Advances paid to suppliers',
    'Выплаты по заработной плате': 'Payroll payments',
    'Налог на прибыль': 'Income tax paid',
    'Другие платежи в бюджет': 'Other budget payments',
    'Выплаты по краткосрочной аренде': 'Short-term lease payments',
    'Прочие выплаты': 'Other operating payments',

    // Investing
    'Притоки': 'Investing inflows',
    'Оттоки': 'Investing outflows',
    'Притоки (ФД)': 'Financing inflows',
    'Оттоки (ФД)': 'Financing outflows',

    // Financing
    'Поступления от займов': 'Proceeds from borrowings',
    'Погашение займов': 'Repayment of borrowings',
    'Выплата дивидендов': 'Dividends paid',
    'ВГО': 'Intercompany eliminations',
};

/**
 * Translate a single label. Returns the English equivalent if found,
 * otherwise returns the original string.
 */
function translateLabel(raw) {
    if (!raw) return raw;
    const trimmed = raw.trim();
    return LABEL_MAP[trimmed] || trimmed;
}

/**
 * Deduplicate labels within a single section's item list.
 * When the same translated label appears more than once, each subsequent
 * occurrence gets an ordinal suffix: "(2)", "(3)", etc.
 *
 * @param {Object[]} items - mutable array of { label, ... }
 */
function deduplicateLabels(items) {
    const seen = {};
    for (const item of items) {
        const base = item.label;
        if (seen[base] === undefined) {
            seen[base] = 1;
        } else {
            seen[base]++;
            item.label = `${base} (${seen[base]})`;
        }
    }
}

function transformToIFRSCashFlow(dataMap, periods, reconciliationItems, additionalSourcesItems) {
    global.logger.logInfo('[CF TRANSFORMER] Starting transformation...');
    global.logger.logInfo(`[CF TRANSFORMER] Input items: ${dataMap.size}`);
    global.logger.logInfo(`[CF TRANSFORMER] Additional sources: ${additionalSourcesItems?.size || 0}`);
    global.logger.logInfo(`[CF TRANSFORMER] Periods: ${periods.length}`);

    const result = {
        sections: [],
        periods: periods || [{ label: 'Total', columnIndex: 1 }],
        operatingTotal: new Array(periods?.length || 1).fill(0),
        investingTotal: new Array(periods?.length || 1).fill(0),
        financingTotal: new Array(periods?.length || 1).fill(0),
        cfTotal: new Array(periods?.length || 1).fill(0),
        fcfTotal: new Array(periods?.length || 1).fill(0),
        additionalSourcesTotal: new Array(periods?.length || 1).fill(0),
    };

    const operatingItems = [];
    const investingItems = [];
    const financingItems = [];
    const additionalSourcesItemsList = [];

    let sectionCounts = { OPERATING: 0, INVESTING: 0, FINANCING: 0, ADDITIONAL_SOURCES: 0 };

    // Process main cash flow items
    for (const [, data] of dataMap.entries()) {
        const item = {
            label: translateLabel(data.lineItem),
            periodValues: data.periodValues,
            total: data.total,
            flowType: data.total < 0 ? 'outflow' : 'inflow',
            indent: data.subSection ? 2 : 1,
            isSubItem: !!data.subSection,
            subSection: data.subSection,
        };

        if (data.section === 'OPERATING') {
            operatingItems.push(item);
            for (let i = 0; i < data.periodValues.length; i++) {
                result.operatingTotal[i] += data.periodValues[i];
            }
            sectionCounts.OPERATING++;
        } else if (data.section === 'INVESTING') {
            investingItems.push(item);
            for (let i = 0; i < data.periodValues.length; i++) {
                result.investingTotal[i] += data.periodValues[i];
            }
            sectionCounts.INVESTING++;
        } else if (data.section === 'FINANCING') {
            financingItems.push(item);
            for (let i = 0; i < data.periodValues.length; i++) {
                result.financingTotal[i] += data.periodValues[i];
            }
            sectionCounts.FINANCING++;
        }
    }

    // Process additional sources items
    if (additionalSourcesItems && additionalSourcesItems.size > 0) {
        for (const [, data] of additionalSourcesItems.entries()) {
            const item = {
                label: translateLabel(data.lineItem),
                periodValues: data.periodValues,
                total: data.total,
                flowType: data.total < 0 ? 'outflow' : 'inflow',
                indent: data.indent || 1,
                isCategory: data.isCategory || false,
            };

            additionalSourcesItemsList.push(item);

            if (!data.isCategory) {
                for (let i = 0; i < data.periodValues.length; i++) {
                    result.additionalSourcesTotal[i] += data.periodValues[i];
                }
            }

            sectionCounts.ADDITIONAL_SOURCES++;
        }
    }

    global.logger.logInfo(`[CF TRANSFORMER] Section distribution: Operating=${sectionCounts.OPERATING}, Investing=${sectionCounts.INVESTING}, Financing=${sectionCounts.FINANCING}, Additional Sources=${sectionCounts.ADDITIONAL_SOURCES}`);

    // Disambiguate duplicate labels within each section
    deduplicateLabels(operatingItems);
    deduplicateLabels(investingItems);
    deduplicateLabels(financingItems);

    // NOTE: Empty sections are left as empty arrays.
    // The styler renders a section total of 0 with no detail rows, which is the
    // correct IFRS presentation when a section has no activity. Placeholder
    // strings ("No financing activities found") must NOT appear in the output.

    // Build sections array
    result.sections.push({ name: 'OPERATING ACTIVITIES', items: operatingItems });
    result.sections.push({ name: 'INVESTING ACTIVITIES', items: investingItems });
    result.sections.push({ name: 'FINANCING ACTIVITIES', items: financingItems });

    // Calculate CF and FCF totals
    for (let i = 0; i < result.periods.length; i++) {
        result.cfTotal[i] = result.operatingTotal[i] + result.investingTotal[i] + result.financingTotal[i];
        result.fcfTotal[i] = result.operatingTotal[i] + result.investingTotal[i];
    }

    // CF summary section (styler writes formula referencing section total rows)
    result.sections.push({
        name: 'CF',
        items: [{
            label: 'Cash Flow (Operating + Investing + Financing)',
            periodValues: result.cfTotal,
            total: result.cfTotal.reduce((s, v) => s + v, 0),
            flowType: 'summary',
            indent: 1,
        }],
        isSummary: true,
    });

    // FCF summary section
    result.sections.push({
        name: 'FCF',
        items: [{
            label: 'Free Cash Flow (Operating + Investing)',
            periodValues: result.fcfTotal,
            total: result.fcfTotal.reduce((s, v) => s + v, 0),
            flowType: 'summary',
            indent: 1,
        }],
        isSummary: true,
    });

    // Additional sources section
    if (additionalSourcesItemsList.length > 0) {
        result.sections.push({ name: 'ADDITIONAL SOURCES', items: additionalSourcesItemsList });
    }
    // If no additional sources, the section is omitted entirely — no placeholder row.

    global.logger.logInfo('[CF TRANSFORMER] Transformation complete');

    return result;
}

module.exports = { transformToIFRSCashFlow };