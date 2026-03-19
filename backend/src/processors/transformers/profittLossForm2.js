// processors/transformers/profitLossForm2.js
// Transforms standard NSBU Form 2 extracted data into the IFRS P&L layout
// descriptor. Reuses the same row-type schema as the budget P&L transformer
// so the existing profitLoss styler can render it without modification.

'use strict';

/**
 * Transform extracted Form 2 data into IFRS P&L layout.
 *
 * @param {Object} extracted - Output of extractProfitLossForm2Data()
 * @returns {Object} { periods, rows, namedRefs } — same shape as budget transformer
 */
function transformForm2ToIFRS(extracted) {
    global.logger.logInfo('[PL-F2 TRANSFORMER] Starting transformation');

    const { periods, dataMap } = extracted;
    const n = periods.length;

    const nullArr = () => new Array(n).fill(null);
    const norm = (arr) => {
        if (!arr || arr.length === 0) return nullArr();
        return arr.map(v => (v === undefined ? null : v));
    };

    // Helper to get values for a row code, applying sign if isNegative
    const vals = (code) => {
        const row = dataMap[code];
        if (!row) return nullArr();
        const raw = norm(row.values);
        // NSBU Form 2 stores costs as positives; we keep them as positives
        // and let the IFRS presentation logic (styler numFmt) handle negatives.
        // The isNegative flag is preserved in the item for the styler.
        return raw;
    };

    const rows = [];

    // ─── I. REVENUE ───────────────────────────────────────────────────────────
    rows.push({ type: 'title', label: 'I. REVENUE' });

    const revenueStart = rows.length;
    rows.push({
        type: 'item',
        label: dataMap['010']?.label || 'Net revenue from sales',
        values: vals('010'),
        nsbuCode: '010',
    });
    const revenueEnd = rows.length;

    rows.push({
        type: 'total',
        label: 'Total Revenue',
        sumRange: { from: revenueStart, to: revenueEnd },
    });
    rows.push({ type: 'blank' });

    // ─── II. COST OF SALES ────────────────────────────────────────────────────
    rows.push({ type: 'title', label: 'II. COST OF SALES' });

    const cogsStart = rows.length;
    rows.push({
        type: 'item',
        label: dataMap['020']?.label || 'Cost of sales',
        values: vals('020'),
        nsbuCode: '020',
        isNegative: true,
    });
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
        addRefs: ['totalRevenue', 'totalCOGS'],
    });
    rows.push({ type: 'blank' });

    // ─── IV. OPERATING EXPENSES ───────────────────────────────────────────────
    rows.push({ type: 'title', label: 'IV. OPERATING EXPENSES' });

    const opexStart = rows.length;

    if (dataMap['040']) {
        rows.push({
            type: 'item',
            label: dataMap['040'].label || 'Selling expenses',
            values: vals('040'),
            nsbuCode: '040',
            isNegative: true,
        });
    }

    if (dataMap['050']) {
        rows.push({
            type: 'item',
            label: dataMap['050'].label || 'Administrative expenses',
            values: vals('050'),
            nsbuCode: '050',
            isNegative: true,
        });
    }

    const opexEnd = rows.length;

    if (opexEnd > opexStart) {
        rows.push({
            type: 'total',
            label: 'Total Operating Expenses',
            sumRange: { from: opexStart, to: opexEnd },
        });
    }
    rows.push({ type: 'blank' });

    // ─── V. OTHER OPERATING ───────────────────────────────────────────────────
    if (dataMap['060'] || dataMap['070']) {
        rows.push({ type: 'title', label: 'V. OTHER OPERATING INCOME / (EXPENSES)' });

        const otherOpStart = rows.length;

        if (dataMap['060']) {
            rows.push({
                type: 'item',
                label: dataMap['060'].label || 'Other operating income',
                values: vals('060'),
                nsbuCode: '060',
            });
        }

        if (dataMap['070']) {
            rows.push({
                type: 'item',
                label: dataMap['070'].label || 'Other operating expenses',
                values: vals('070'),
                nsbuCode: '070',
                isNegative: true,
            });
        }

        const otherOpEnd = rows.length;
        rows.push({
            type: 'total',
            label: 'Net other operating',
            sumRange: { from: otherOpStart, to: otherOpEnd },
        });
        rows.push({ type: 'blank' });
    }

    // ─── VI. OPERATING PROFIT (EBIT) ──────────────────────────────────────────
    const ebitIndex = rows.length;
    rows.push({
        type: 'calculated',
        label: 'VI. OPERATING PROFIT / (LOSS) (EBIT)',
        // = Gross Profit + Operating Expenses total + Other operating total
        // Use named refs and positional refs together
        addRefs: ['grossProfit', ...(opexEnd > opexStart ? [opexEnd] : []),
            ...(dataMap['060'] || dataMap['070'] ? [rows.findIndex(
                r => r.label === 'Net other operating'
            )] : [])],
    });
    rows.push({ type: 'blank' });

    // ─── VII. FINANCE INCOME / (COSTS) ────────────────────────────────────────
    rows.push({ type: 'title', label: 'VII. FINANCE INCOME / (COSTS)' });

    const financeStart = rows.length;

    if (dataMap['090']) {
        rows.push({
            type: 'item',
            label: dataMap['090'].label || 'Finance income',
            values: vals('090'),
            nsbuCode: '090',
        });
    } else {
        rows.push({ type: 'item', label: '  Finance income', values: nullArr() });
    }

    if (dataMap['100']) {
        rows.push({
            type: 'item',
            label: dataMap['100'].label || 'Finance costs',
            values: vals('100'),
            nsbuCode: '100',
            isNegative: true,
        });
    } else {
        rows.push({ type: 'item', label: '  Finance costs', values: nullArr() });
    }

    const financeEnd = rows.length;

    const netFinanceIndex = rows.length;
    rows.push({
        type: 'total',
        label: 'Net finance income / (costs)',
        sumRange: { from: financeStart, to: financeEnd },
    });
    rows.push({ type: 'blank' });

    // ─── VIII. OTHER INCOME / (EXPENSES) ─────────────────────────────────────
    if (dataMap['110'] || dataMap['120']) {
        rows.push({ type: 'title', label: 'VIII. OTHER INCOME / (EXPENSES)' });

        const otherStart = rows.length;

        if (dataMap['110']) {
            rows.push({
                type: 'item',
                label: dataMap['110'].label || 'Other income',
                values: vals('110'),
                nsbuCode: '110',
            });
        }

        if (dataMap['120']) {
            rows.push({
                type: 'item',
                label: dataMap['120'].label || 'Other expenses',
                values: vals('120'),
                nsbuCode: '120',
                isNegative: true,
            });
        }

        const otherEnd = rows.length;
        rows.push({
            type: 'total',
            label: 'Net other income / (expenses)',
            sumRange: { from: otherStart, to: otherEnd },
        });
        rows.push({ type: 'blank' });
    }

    // ─── IX. PROFIT BEFORE TAX ────────────────────────────────────────────────
    const pbtIndex = rows.length;
    rows.push({
        type: 'calculated',
        label: 'IX. PROFIT BEFORE TAX',
        addRefs: [ebitIndex, netFinanceIndex,
            ...(rows.findIndex(r => r.label === 'Net other income / (expenses)') >= 0
                ? [rows.findIndex(r => r.label === 'Net other income / (expenses)')]
                : [])
        ],
    });
    rows.push({ type: 'blank' });

    // ─── X. INCOME TAX ────────────────────────────────────────────────────────
    rows.push({ type: 'title', label: 'X. INCOME TAX' });

    const incomeTaxIndex = rows.length;
    rows.push({
        type: 'item',
        label: dataMap['140']?.label || 'Income tax expense',
        values: vals('140'),
        nsbuCode: '140',
        isNegative: true,
    });
    rows.push({ type: 'blank' });

    // ─── XI. NET PROFIT / (LOSS) ──────────────────────────────────────────────
    rows.push({
        type: 'calculated',
        label: 'XI. NET PROFIT / (LOSS)',
        addRefs: [pbtIndex, incomeTaxIndex],
    });

    // Named refs for the styler's formula resolution
    const totalRevenueRowIdx = rows.findIndex(r => r.type === 'total' && r.label === 'Total Revenue');
    const totalCOGSRowIdx = rows.findIndex(r => r.type === 'total' && r.label === 'Total Cost of Sales');
    const namedRefs = {
        totalRevenue: totalRevenueRowIdx,
        totalCOGS: totalCOGSRowIdx,
        grossProfit: grossProfitIndex,
    };

    global.logger.logInfo(`[PL-F2 TRANSFORMER] Output rows: ${rows.length}`);

    return { periods, rows, namedRefs };
}

module.exports = { transformForm2ToIFRS };