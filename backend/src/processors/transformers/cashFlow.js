// transformers/cashFlow.js - WITH ADDITIONAL SOURCES OF CASH FLOW SECTION

function transformToIFRSCashFlow(dataMap, periods, reconciliationItems, additionalSourcesItems) {
    global.logger.logInfo('[CF TRANSFORMER] Starting transformation...');
    global.logger.logInfo(`[CF TRANSFORMER] Input items: ${dataMap.size}`);
    global.logger.logInfo(`[CF TRANSFORMER] Additional sources: ${additionalSourcesItems?.size || 0}`);
    global.logger.logInfo(`[CF TRANSFORMER] Reconciliation items: ${reconciliationItems?.size || 0}`);
    global.logger.logInfo(`[CF TRANSFORMER] Periods: ${periods.length}`);

    const result = {
        sections: [],
        periods: periods || [{ label: 'Total', columnIndex: 1 }],
        operatingTotal: new Array(periods?.length || 1).fill(0),
        investingTotal: new Array(periods?.length || 1).fill(0),
        financingTotal: new Array(periods?.length || 1).fill(0),
        additionalSourcesTotal: new Array(periods?.length || 1).fill(0),
        netChange: new Array(periods?.length || 1).fill(0),
        reconciliation: [],  // FCF only
        fxEffects: new Array(periods?.length || 1).fill(0),
        cashBeginning: new Array(periods?.length || 1).fill(0),
        cashEnding: new Array(periods?.length || 1).fill(0)
    };

    const operatingItems = [];
    const investingItems = [];
    const financingItems = [];
    const additionalSourcesItemsList = [];

    let sectionCounts = { OPERATING: 0, INVESTING: 0, FINANCING: 0, ADDITIONAL_SOURCES: 0 };

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

    // Process additional sources items
    if (additionalSourcesItems && additionalSourcesItems.size > 0) {
        for (const [key, data] of additionalSourcesItems.entries()) {
            const item = {
                label: data.lineItem,
                periodValues: data.periodValues,
                total: data.total,
                flowType: data.total < 0 ? 'outflow' : 'inflow',
                indent: data.indent || 1,
                isCategory: data.isCategory || false
            };

            additionalSourcesItemsList.push(item);

            // Only add to totals if it's not a category header
            if (!data.isCategory) {
                for (let i = 0; i < data.periodValues.length; i++) {
                    result.additionalSourcesTotal[i] += data.periodValues[i];
                }
            }

            sectionCounts.ADDITIONAL_SOURCES++;
            global.logger.logInfo(`[CF TRANSFORMER] Additional source: "${data.lineItem}"`);
        }
    }

    // Process reconciliation items (FCF only)
    if (reconciliationItems && reconciliationItems.size > 0) {
        for (const [key, data] of reconciliationItems.entries()) {
            result.reconciliation.push({
                label: data.lineItem,
                periodValues: data.periodValues,
                total: data.total,
                type: data.type  // 'FCF'
            });
            global.logger.logInfo(`[CF TRANSFORMER] Reconciliation: "${data.lineItem}" (${data.type})`);
        }
    }

    global.logger.logInfo(`[CF TRANSFORMER] Section distribution: Operating=${sectionCounts.OPERATING}, Investing=${sectionCounts.INVESTING}, Financing=${sectionCounts.FINANCING}, Additional Sources=${sectionCounts.ADDITIONAL_SOURCES}`);

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

    // Add additional sources section if items exist
    if (additionalSourcesItemsList.length > 0) {
        result.sections.push({
            name: 'ADDITIONAL SOURCES OF CASH FLOW',
            items: additionalSourcesItemsList
        });
    } else {
        // Add placeholder if no data
        result.sections.push({
            name: 'ADDITIONAL SOURCES OF CASH FLOW',
            items: [{
                label: 'No other additional source of cash flow',
                periodValues: new Array(result.periods.length).fill(0),
                total: 0,
                flowType: 'inflow',
                indent: 1
            }]
        });
    }

    // Calculate totals - DO NOT include net change, cash beginning/ending
    for (let i = 0; i < result.periods.length; i++) {
        result.netChange[i] = result.operatingTotal[i] + result.investingTotal[i] + result.financingTotal[i] + result.additionalSourcesTotal[i];
    }

    global.logger.logInfo('[CF TRANSFORMER] Transformation complete');

    return result;
}

module.exports = {
    transformToIFRSCashFlow
};