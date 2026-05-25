/**
 * Auto-converted from backend/src/mappings/profitLossForm2Mapping.js.
 * Logic / data preserved exactly; only the module syntax was changed.
 */

// mappings/profitLossForm2Mapping.js
//
// NSBU Form 2 (Отчет о финансовых результатах, ОКУД 0710002) row code mapping.
//
// SOURCE OF TRUTH: Order of the Minister of Finance of the Republic of
// Uzbekistan No. 140 (27.12.2002), Appendix No. 2, in the editions of:
//   - Order No. 10 (23.01.2019, reg. № 1209-10)
//   - Earlier amendments: 2004, 2012, 2016, 2017
// Russian descriptions match the legal text verbatim. Calculated row formulas
// come directly from the form's own row labels (e.g. "(стр.030-040+090)").
//
// IFRS classifications follow IAS 1 presentation requirements; sign
// conventions reflect how each line presents in IFRS (positive contribution
// to profit vs. deduction).
//
// Used both by the extractor (to detect known codes) and by the transformation
// enricher (to attach IFRS metadata to source rows at read time).// ─── Row codes ────────────────────────────────────────────────────────────────
// Each entry covers ALL codes that appear on the official NSBU Form 2.
// Calculated rows include a `formula` field with referenced row codes.
export const FORM2_ROW_CODES: Record<string, any> = {
    // ── REVENUE ──────────────────────────────────────────────────────────────
    '010': {
        label: 'Revenue (net)',
        section: 'revenue',
        ifrsClassification: 'Revenue',
        nsbuDescription: 'Чистая выручка от реализации продукции (товаров, работ и услуг)',
        isCalculated: false,
    },

    // ── COST OF SALES ────────────────────────────────────────────────────────
    '020': {
        label: 'Cost of sales',
        section: 'cogs',
        ifrsClassification: 'Cost of sales',
        nsbuDescription: 'Себестоимость реализованной продукции (товаров, работ и услуг)',
        isCalculated: false,
        isNegative: true,
    },

    // ── GROSS PROFIT (calculated: 010 - 020) ─────────────────────────────────
    '030': {
        label: 'Gross profit',
        section: 'gross',
        ifrsClassification: 'Gross profit',
        nsbuDescription: 'Валовая прибыль (убыток) от реализации продукции',
        isCalculated: true,
        formula: { op: 'subtract', operands: ['010', '020'] },
    },

    // ── PERIOD EXPENSES (calculated: 050+060+070+080) ────────────────────────
    '040': {
        label: 'Period expenses, total',
        section: 'opex',
        ifrsClassification: 'Operating expenses, total',
        nsbuDescription: 'Расходы периода, всего',
        isCalculated: true,
        formula: { op: 'add', operands: ['050', '060', '070', '080'] },
        isNegative: true,
    },
    '050': {
        label: 'Selling expenses',
        section: 'opex',
        ifrsClassification: 'Selling and distribution expenses',
        nsbuDescription: 'Расходы по реализации',
        isCalculated: false,
        isNegative: true,
    },
    '060': {
        label: 'Administrative expenses',
        section: 'opex',
        ifrsClassification: 'Administrative expenses',
        nsbuDescription: 'Административные расходы',
        isCalculated: false,
        isNegative: true,
    },
    '070': {
        label: 'Other operating expenses',
        section: 'opex',
        ifrsClassification: 'Other operating expenses',
        nsbuDescription: 'Прочие операционные расходы',
        isCalculated: false,
        isNegative: true,
    },
    '080': {
        // NSBU treats this as a deferred / future-deductible expense.
        // For IFRS reporting purposes this is typically immaterial / nil.
        label: 'Period expenses deductible in future',
        section: 'opex',
        ifrsClassification: 'Deferred period expenses',
        nsbuDescription: 'Расходы отчетного периода, вычитаемые из налогооблагаемой прибыли в будущем',
        isCalculated: false,
        isNegative: true,
    },

    // ── OTHER OPERATING INCOME ───────────────────────────────────────────────
    '090': {
        label: 'Other operating income',
        section: 'otherOp',
        ifrsClassification: 'Other operating income',
        nsbuDescription: 'Прочие доходы от основной деятельности',
        isCalculated: false,
    },

    // ── OPERATING PROFIT (calculated: 030 - 040 + 090) ───────────────────────
    '100': {
        label: 'Operating profit / (loss)',
        section: 'operating',
        ifrsClassification: 'Profit / (loss) from operations',
        nsbuDescription: 'Прибыль (убыток) от основной деятельности',
        isCalculated: true,
        formula: {
            op: 'compose', operands: [
                { op: 'subtract', operands: ['030', '040'] },
                '090'
            ], reducer: 'add'
        },
    },

    // ── FINANCE INCOME (calculated total: 120+130+140+150+160) ───────────────
    '110': {
        label: 'Finance income, total',
        section: 'finance',
        ifrsClassification: 'Finance income',
        nsbuDescription: 'Доходы от финансовой деятельности, всего',
        isCalculated: true,
        formula: { op: 'add', operands: ['120', '130', '140', '150', '160'] },
    },
    '120': {
        label: 'Dividend income',
        section: 'finance',
        ifrsClassification: 'Dividend income',
        nsbuDescription: 'Доходы в виде дивидендов',
        isCalculated: false,
    },
    '130': {
        label: 'Interest income',
        section: 'finance',
        ifrsClassification: 'Interest income',
        nsbuDescription: 'Доходы в виде процентов',
        isCalculated: false,
    },
    '140': {
        label: 'Finance lease income',
        section: 'finance',
        ifrsClassification: 'Finance lease income',
        nsbuDescription: 'Доходы от финансовой аренды',
        isCalculated: false,
    },
    '150': {
        label: 'Foreign exchange gains',
        section: 'finance',
        ifrsClassification: 'Foreign exchange gains',
        nsbuDescription: 'Доходы от валютных курсовых разниц',
        isCalculated: false,
    },
    '160': {
        label: 'Other finance income',
        section: 'finance',
        ifrsClassification: 'Other finance income',
        nsbuDescription: 'Прочие доходы от финансовой деятельности',
        isCalculated: false,
    },

    // ── FINANCE COSTS (calculated total: 180+190+200+210) ────────────────────
    '170': {
        label: 'Finance costs, total',
        section: 'finance',
        ifrsClassification: 'Finance costs',
        nsbuDescription: 'Расходы по финансовой деятельности',
        isCalculated: true,
        formula: { op: 'add', operands: ['180', '190', '200', '210'] },
        isNegative: true,
    },
    '180': {
        label: 'Interest expense',
        section: 'finance',
        ifrsClassification: 'Interest expense',
        nsbuDescription: 'Расходы в виде процентов',
        isCalculated: false,
        isNegative: true,
    },
    '190': {
        label: 'Finance lease interest expense',
        section: 'finance',
        ifrsClassification: 'Finance lease interest expense',
        nsbuDescription: 'Расходы в виде процентов по финансовой аренде',
        isCalculated: false,
        isNegative: true,
    },
    '200': {
        label: 'Foreign exchange losses',
        section: 'finance',
        ifrsClassification: 'Foreign exchange losses',
        nsbuDescription: 'Убытки от валютных курсовых разниц',
        isCalculated: false,
        isNegative: true,
    },
    '210': {
        label: 'Other finance costs',
        section: 'finance',
        ifrsClassification: 'Other finance costs',
        nsbuDescription: 'Прочие расходы по финансовой деятельности',
        isCalculated: false,
        isNegative: true,
    },

    // ── PROFIT FROM ALL OPERATING ACTIVITIES (calculated: 100 + 110 - 170) ───
    '220': {
        label: 'Profit / (loss) from operations and finance',
        section: 'pretax',
        ifrsClassification: 'Profit before extraordinary items',
        nsbuDescription: 'Прибыль (убыток) от общехозяйственной деятельности',
        isCalculated: true,
        formula: {
            op: 'compose', operands: [
                '100',
                '110',
                { op: 'negate', operand: '170' }
            ], reducer: 'add'
        },
    },

    // ── EXTRAORDINARY ITEMS ──────────────────────────────────────────────────
    '230': {
        label: 'Extraordinary gains / (losses)',
        section: 'extraordinary',
        // NOTE: IFRS (IAS 1.87) prohibits presenting items as "extraordinary".
        // For the IFRS output, this maps into "Other gains/(losses)" if non-zero.
        ifrsClassification: 'Other gains / (losses)',
        nsbuDescription: 'Чрезвычайные прибыли и убытки',
        isCalculated: false,
    },

    // ── PROFIT BEFORE TAX (calculated: 220 +/- 230) ──────────────────────────
    '240': {
        label: 'Profit / (loss) before tax',
        section: 'pretax',
        ifrsClassification: 'Profit before income tax',
        nsbuDescription: 'Прибыль (убыток) до уплаты налога на прибыль',
        isCalculated: true,
        formula: { op: 'add', operands: ['220', '230'] },
    },

    // ── TAX ──────────────────────────────────────────────────────────────────
    '250': {
        label: 'Income tax',
        section: 'tax',
        ifrsClassification: 'Income tax expense',
        nsbuDescription: 'Налог на прибыль',
        isCalculated: false,
        isNegative: true,
    },
    '260': {
        label: 'Other mandatory profit-related payments',
        section: 'tax',
        // Per IAS 12, only income taxes go in tax expense; mandatory levies on
        // profit are typically also reported in tax line for IFRS presentation.
        ifrsClassification: 'Other taxes on profit',
        nsbuDescription: 'Прочие налоги и другие обязательные платежи от прибыли',
        isCalculated: false,
        isNegative: true,
    },

    // ── NET PROFIT (calculated: 240 - 250 - 260) ─────────────────────────────
    '270': {
        label: 'Net profit / (loss) for the period',
        section: 'net',
        ifrsClassification: 'Profit / (loss) for the period',
        nsbuDescription: 'Чистая прибыль (убыток) отчетного периода',
        isCalculated: true,
        formula: {
            op: 'compose', operands: [
                '240',
                { op: 'negate', operand: '250' },
                { op: 'negate', operand: '260' }
            ], reducer: 'add'
        },
    },
};

// Codes the extractor should NOT extract values for — they are computed from
// other rows. (Same set as before, expanded for the full form.)
export const CALCULATED_CODES = new Set(
    Object.entries(FORM2_ROW_CODES)
        .filter(([, def]) => def.isCalculated)
        .map(([code]) => code)
);

/**
 * Look up mapping for a Form 2 row code.
 * @param {string} code - Padded 3-digit code (e.g., '010', '040')
 * @returns {Object|null}
 */
export function getProfitLossForm2Mapping(code: string): any {
    const c = String(code).padStart(3, '0').trim();
    return FORM2_ROW_CODES[c] || null;
}

