// processors/transformers/profitLoss.js
// Maps extracted NSBU P&L data to the IFRS P&L section structure.
// Produces a layout descriptor consumed by the styler.

'use strict';

/**
 * Transform extracted P&L data into IFRS-structured layout.
 *
 * The returned object describes EVERY row that will appear in the output
 * worksheet, in order. The styler uses this to write cells and formulas.
 *
 * Row types:
 *   title         – bold Roman-numeral section heading (I. REVENUE etc.)
 *   subheader     – italic sub-section label (e.g. "Project overhead expenses")
 *   item          – individual line item with data values
 *   total         – calculated total row (formula written by styler)
 *   blank         – empty spacer row
 *
 * @param {Object} extracted - Output of extractProfitLossData()
 * @returns {Object} IFRS layout descriptor
 */
function transformToIFRSProfitLoss(extracted) {
    global.logger.logInfo('[PL TRANSFORMER] Starting transformation');
    global.logger.logInfo(`[PL TRANSFORMER] Revenue items: ${extracted.revenueItems.length}`);
    global.logger.logInfo(`[PL TRANSFORMER] COGS items: ${extracted.cogsItems.length}`);

    const {
        periods,
        revenueItems,
        cogsItems,
        genServices,
        overheadFOT,
        overheadESP,
        overheadOther,
        adminFOT,
        adminESP,
        adminVehicles,
        adminOther,
        depreciation,
        financeIncomeItems,
        incomeTax,
    } = extracted;

    const n = periods.length;

    // Helper: zero-fill nulls for comparison, keep null for display
    const nullArr = () => new Array(n).fill(null);

    // Helper: normalise a values array (replace undefined with null)
    const norm = (arr) => {
        if (!arr || arr.length === 0) return nullArr();
        return arr.map((v) => (v === undefined ? null : v));
    };

    // ── Build the rows array ──────────────────────────────────────────────────

    const rows = [];

    // ─── I. REVENUE ───────────────────────────────────────────────────────────
    rows.push({ type: 'title', label: 'I. REVENUE' });
    rows.push({ type: 'subheader', label: 'Contract revenue from construction services' });

    const revenueStart = rows.length; // index into rows[] of first revenue item
    for (const item of revenueItems) {
        rows.push({ type: 'item', label: `  ${item.name}`, values: norm(item.values) });
    }
    const revenueEnd = rows.length; // exclusive end

    rows.push({
        type: 'total',
        label: 'Total Revenue',
        sumRange: { from: revenueStart, to: revenueEnd }, // row indices into rows[]
    });
    rows.push({ type: 'blank' });

    // ─── II. COST OF SALES ────────────────────────────────────────────────────
    rows.push({ type: 'title', label: 'II. COST OF SALES (COGS)' });
    rows.push({ type: 'subheader', label: 'Direct contract costs - subcontractor work' });

    const cogsStart = rows.length;
    for (const item of cogsItems) {
        rows.push({ type: 'item', label: `  ${item.name}`, values: norm(item.values) });
    }
    const cogsEnd = rows.length;

    rows.push({
        type: 'total',
        label: 'Total Cost of Sales',
        sumRange: { from: cogsStart, to: cogsEnd },
    });
    rows.push({ type: 'blank' });

    // ─── III. GROSS PROFIT ────────────────────────────────────────────────────
    const grossProfitIndex = rows.length;
    rows.push({
        type: 'calculated',
        label: 'III. GROSS PROFIT',
        // = Total Revenue + Total Cost of Sales
        addRefs: ['totalRevenue', 'totalCOGS'],
    });
    rows.push({ type: 'blank' });

    // ─── IV. OPERATING EXPENSES ───────────────────────────────────────────────
    rows.push({ type: 'title', label: 'IV. OPERATING EXPENSES' });
    rows.push({ type: 'subheader', label: 'Project overhead expenses' });

    const overheadFOTIndex = rows.length;
    rows.push({ type: 'item', label: '  Employee compensation', values: norm(overheadFOT) });

    const overheadESPIndex = rows.length;
    rows.push({ type: 'item', label: '  Social security contributions (ЕСП)', values: norm(overheadESP) });

    const overheadOtherIndex = rows.length;
    rows.push({ type: 'item', label: '  Other project costs', values: norm(overheadOther) });

    rows.push({ type: 'blank' });
    rows.push({ type: 'subheader', label: 'Administrative and general expenses' });

    const adminFOTIndex = rows.length;
    rows.push({ type: 'item', label: '  Salaries and wages (ФОТ)', values: norm(adminFOT) });

    const adminESPIndex = rows.length;
    rows.push({ type: 'item', label: '  Social security contributions (ЕСП)', values: norm(adminESP) });

    const adminVehiclesIndex = rows.length;
    rows.push({ type: 'item', label: '  Vehicle maintenance and fuel', values: norm(adminVehicles) });

    const adminOtherIndex = rows.length;
    rows.push({ type: 'item', label: '  Other operating expenses', values: norm(adminOther) });

    rows.push({ type: 'blank' });

    const totalOpExpIndex = rows.length;
    rows.push({
        type: 'calculated',
        label: 'Total Operating Expenses',
        addRefs: [
            overheadFOTIndex, overheadESPIndex, overheadOtherIndex,
            adminFOTIndex, adminESPIndex, adminVehiclesIndex, adminOtherIndex,
        ],
    });
    rows.push({ type: 'blank' });

    const genServicesIndex = rows.length;
    rows.push({
        type: 'item',
        label: 'General contractor service fees',
        values: norm(genServices),
    });
    rows.push({ type: 'blank' });

    const totalOpAdminIndex = rows.length;
    rows.push({
        type: 'calculated',
        label: 'Total Operating and Admin Expenses',
        addRefs: [totalOpExpIndex, genServicesIndex],
    });
    rows.push({ type: 'blank' });

    // ─── V. EBITDA ────────────────────────────────────────────────────────────
    const ebitdaIndex = rows.length;
    rows.push({
        type: 'calculated',
        label: 'V. EBITDA (Operating Profit before D&A)',
        addRefs: ['grossProfit', totalOpAdminIndex],
    });
    rows.push({ type: 'blank' });

    // ─── VI. DEPRECIATION & AMORTIZATION ─────────────────────────────────────
    rows.push({ type: 'title', label: 'VI. DEPRECIATION & AMORTIZATION' });

    const daIndex = rows.length;
    rows.push({
        type: 'item',
        label: 'Depreciation and amortization expense',
        values: norm(depreciation),
    });
    rows.push({ type: 'blank' });

    // ─── VII. OPERATING PROFIT (EBIT) ─────────────────────────────────────────
    const ebitIndex = rows.length;
    rows.push({
        type: 'calculated',
        label: 'VII. OPERATING PROFIT (EBIT)',
        addRefs: [ebitdaIndex, daIndex],
    });
    rows.push({ type: 'blank' });

    // ─── VIII. FINANCE INCOME / (COSTS) ──────────────────────────────────────
    rows.push({ type: 'title', label: 'VIII. FINANCE INCOME / (COSTS)' });

    // Finance income: use financeIncomeItems if present, otherwise a zero line
    const financeIncomeIndex = rows.length;
    if (financeIncomeItems && financeIncomeItems.length > 0) {
        for (const item of financeIncomeItems) {
            rows.push({ type: 'item', label: `  ${item.name}`, values: norm(item.values) });
        }
    } else {
        rows.push({ type: 'item', label: 'Finance income', values: nullArr() });
    }

    const financeCostsIndex = rows.length;
    rows.push({ type: 'item', label: 'Finance costs', values: nullArr() });

    const netFinanceIndex = rows.length;
    rows.push({ type: 'item', label: 'Net finance result', values: nullArr() });

    rows.push({ type: 'blank' });

    // ─── IX. PROFIT BEFORE TAX ────────────────────────────────────────────────
    const pbtIndex = rows.length;
    rows.push({
        type: 'calculated',
        label: 'IX. PROFIT BEFORE TAX',
        addRefs: [ebitIndex, netFinanceIndex],
    });
    rows.push({ type: 'blank' });

    // ─── X. INCOME TAX ────────────────────────────────────────────────────────
    rows.push({ type: 'title', label: 'X. INCOME TAX' });

    const incomeTaxIndex = rows.length;
    rows.push({
        type: 'item',
        label: 'Income tax expense',
        values: norm(incomeTax),
    });
    rows.push({ type: 'blank' });

    // ─── XI. NET PROFIT / (LOSS) ──────────────────────────────────────────────
    rows.push({
        type: 'calculated',
        label: 'XI. NET PROFIT / (LOSS)',
        addRefs: [pbtIndex, incomeTaxIndex],
    });

    // ── Named index map for formula resolution ────────────────────────────────
    // Find actual row indices for named references used in addRefs
    const totalRevenueRowIdx = rows.findIndex(
        (r) => r.type === 'total' && r.label === 'Total Revenue'
    );
    const totalCOGSRowIdx = rows.findIndex(
        (r) => r.type === 'total' && r.label === 'Total Cost of Sales'
    );
    const namedRefs = {
        totalRevenue: totalRevenueRowIdx,
        totalCOGS: totalCOGSRowIdx,
        grossProfit: grossProfitIndex,
    };

    global.logger.logInfo(`[PL TRANSFORMER] Total output rows: ${rows.length}`);
    global.logger.logInfo('[PL TRANSFORMER] Transformation complete');

    return {
        periods,
        rows,
        namedRefs,
    };
}

module.exports = { transformToIFRSProfitLoss };