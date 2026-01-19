// transformers/cashFlow.js - FIXED WITH PERIOD SUPPORT

function transformToIFRSCashFlow(dataMap, periods) {
    global.logger.logInfo('[CF TRANSFORMER] Starting transformation...');
    global.logger.logInfo(`[CF TRANSFORMER] Input items: ${dataMap.size}`);
    global.logger.logInfo(`[CF TRANSFORMER] Periods: ${periods.length}`);

    const result = {
        sections: [],
        periods: periods || [{ label: 'Total', columnIndex: 1 }],
        operatingTotal: new Array(periods?.length || 1).fill(0),
        investingTotal: new Array(periods?.length || 1).fill(0),
        financingTotal: new Array(periods?.length || 1).fill(0),
        netChange: new Array(periods?.length || 1).fill(0),
        fxEffects: new Array(periods?.length || 1).fill(0),
        cashBeginning: new Array(periods?.length || 1).fill(0),
        cashEnding: new Array(periods?.length || 1).fill(0)
    };

    // Organize data by sections
    const operatingItems = [];
    const investingItems = [];
    const financingItems = [];

    let sectionCounts = { OPERATING: 0, INVESTING: 0, FINANCING: 0 };

    for (const [key, data] of dataMap.entries()) {
        // Keep original item name
        const label = data.lineItem;

        const item = {
            label: label,
            periodValues: data.periodValues,
            total: data.total,
            flowType: data.total < 0 ? 'outflow' : 'inflow',
            indent: 1,
            subSection: data.subSection  // Preserve subsection for grouping
        };

        // Add sub-item markers for detail lines
        if (data.subSection) {
            item.indent = 2;
            item.isSubItem = true;
        }

        // Route to appropriate section
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

        global.logger.logInfo(`[CF TRANSFORMER] "${data.lineItem}" → ${data.section}/${data.subSection || 'none'} (total: ${data.total.toFixed(2)})`);
    }

    global.logger.logInfo(`[CF TRANSFORMER] Section distribution: Operating=${sectionCounts.OPERATING}, Investing=${sectionCounts.INVESTING}, Financing=${sectionCounts.FINANCING}`);

    // Add default items if sections are empty
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

    // Build sections
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

    // Calculate totals for each period
    for (let i = 0; i < result.periods.length; i++) {
        result.netChange[i] = result.operatingTotal[i] + result.investingTotal[i] + result.financingTotal[i];
        result.cashEnding[i] = result.cashBeginning[i] + result.netChange[i] + result.fxEffects[i];
    }

    global.logger.logInfo('[CF TRANSFORMER] Transformation complete');
    global.logger.logInfo(`[CF TRANSFORMER] Operating totals: ${result.operatingTotal.map(v => v.toFixed(2)).join(', ')}`);
    global.logger.logInfo(`[CF TRANSFORMER] Investing totals: ${result.investingTotal.map(v => v.toFixed(2)).join(', ')}`);
    global.logger.logInfo(`[CF TRANSFORMER] Financing totals: ${result.financingTotal.map(v => v.toFixed(2)).join(', ')}`);

    return result;
}

module.exports = {
    transformToIFRSCashFlow
};