// transformers/cashFlow.js - WITH RECONCILIATION SECTION

function transformToIFRSCashFlow(dataMap, periods, reconciliationItems) {
    global.logger.logInfo('[CF TRANSFORMER] Starting transformation...');
    global.logger.logInfo(`[CF TRANSFORMER] Input items: ${dataMap.size}`);
    global.logger.logInfo(`[CF TRANSFORMER] Reconciliation items: ${reconciliationItems?.size || 0}`);
    global.logger.logInfo(`[CF TRANSFORMER] Periods: ${periods.length}`);

    const result = {
        sections: [],
        periods: periods || [{ label: 'Total', columnIndex: 1 }],
        operatingTotal: new Array(periods?.length || 1).fill(0),
        investingTotal: new Array(periods?.length || 1).fill(0),
        financingTotal: new Array(periods?.length || 1).fill(0),
        netChange: new Array(periods?.length || 1).fill(0),
        reconciliation: [],  // FCF, metal flows, etc.
        fxEffects: new Array(periods?.length || 1).fill(0),
        cashBeginning: new Array(periods?.length || 1).fill(0),
        cashEnding: new Array(periods?.length || 1).fill(0)
    };

    const operatingItems = [];
    const investingItems = [];
    const financingItems = [];

    let sectionCounts = { OPERATING: 0, INVESTING: 0, FINANCING: 0 };

    // Process main cash flow items
    for (const [key, data] of dataMap.entries()) {
        const label = data.lineItem;

        const item = {
            label: label,
            periodValues: data.periodValues,
            total: data.total,
            flowType: data.total < 0 ? 'outflow' : 'inflow',
            indent: 1,
            subSection: data.subSection
        };

        if (data.subSection) {
            item.indent = 2;
            item.isSubItem = true;
        }

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

    // Process reconciliation items (FCF, metal flows, etc.)
    if (reconciliationItems && reconciliationItems.size > 0) {
        for (const [key, data] of reconciliationItems.entries()) {
            result.reconciliation.push({
                label: data.lineItem,
                periodValues: data.periodValues,
                total: data.total,
                type: data.type  // 'FCF' or 'ADJUSTMENT'
            });
            global.logger.logInfo(`[CF TRANSFORMER] Reconciliation: "${data.lineItem}" (${data.type})`);
        }
    }

    global.logger.logInfo(`[CF TRANSFORMER] Section distribution: Operating=${sectionCounts.OPERATING}, Investing=${sectionCounts.INVESTING}, Financing=${sectionCounts.FINANCING}`);

    // Add defaults if empty
    if (operatingItems.length === 0) {
        operatingItems.push({
            label: 'No operating activities found',
            periodValues: new Array(result.periods.length).fill(0),
            total: 0,
            flowType: 'inflow',
            indent: 1
        });
    }

    if (investingItems.length === 0) {
        investingItems.push({
            label: 'No investing activities found',
            periodValues: new Array(result.periods.length).fill(0),
            total: 0,
            flowType: 'inflow',
            indent: 1
        });
    }

    if (financingItems.length === 0) {
        financingItems.push({
            label: 'No financing activities found',
            periodValues: new Array(result.periods.length).fill(0),
            total: 0,
            flowType: 'inflow',
            indent: 1
        });
    }

    result.sections.push({
        name: 'OPERATING ACTIVITIES',
        items: operatingItems
    });

    result.sections.push({
        name: 'INVESTING ACTIVITIES',
        items: investingItems
    });

    result.sections.push({
        name: 'FINANCING ACTIVITIES',
        items: financingItems
    });

    // Calculate totals
    for (let i = 0; i < result.periods.length; i++) {
        result.netChange[i] = result.operatingTotal[i] + result.investingTotal[i] + result.financingTotal[i];
        result.cashEnding[i] = result.cashBeginning[i] + result.netChange[i] + result.fxEffects[i];
    }

    global.logger.logInfo('[CF TRANSFORMER] Transformation complete');

    return result;
}

module.exports = {
    transformToIFRSCashFlow
};