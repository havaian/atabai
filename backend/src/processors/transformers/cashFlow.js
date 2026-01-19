// transformers/cashFlow.js - STRUCTURE-BASED VERSION

/**
 * Cash Flow Transformer - MINIMAL MAPPING VERSION
 * Categorizes by section structure, keeps original item names
 * Flexible for Russian, Uzbek, or any language
 */

function transformToIFRSCashFlow(dataMap) {
    global.logger.logInfo('[CF TRANSFORMER] Starting transformation...');
    global.logger.logInfo(`[CF TRANSFORMER] Input items: ${dataMap.size}`);

    const result = {
        sections: [],
        operatingTotal: 0,
        investingTotal: 0,
        financingTotal: 0,
        netChange: 0,
        fxEffects: 0,
        cashBeginning: 0,
        cashEnding: 0
    };

    // Organize data by sections
    const operatingItems = [];
    const investingItems = [];
    const financingItems = [];

    // Track section item counts for logging
    let sectionCounts = { OPERATING: 0, INVESTING: 0, FINANCING: 0 };

    for (const [key, data] of dataMap.entries()) {
        // Keep original item name - don't translate
        const label = key;

        const item = {
            label: label,
            amount: data.total,
            flowType: data.total < 0 ? 'outflow' : 'inflow',
            indent: 1
        };

        // Add sub-item markers for detail lines
        if (data.subSection) {
            item.indent = 2;
            item.isSubItem = true;
        }

        // Route to appropriate section based on extracted section
        // The extractor already determined the correct section from file structure
        if (data.section === 'OPERATING') {
            operatingItems.push(item);
            result.operatingTotal += data.total;
            sectionCounts.OPERATING++;
        } else if (data.section === 'INVESTING') {
            investingItems.push(item);
            result.investingTotal += data.total;
            sectionCounts.INVESTING++;
        } else if (data.section === 'FINANCING') {
            financingItems.push(item);
            result.financingTotal += data.total;
            sectionCounts.FINANCING++;
        }

        global.logger.logInfo(`[CF TRANSFORMER] "${key}" → ${data.section} (${data.total.toFixed(2)})`);
    }

    // Log section distribution
    global.logger.logInfo(`[CF TRANSFORMER] Section distribution: Operating=${sectionCounts.OPERATING}, Investing=${sectionCounts.INVESTING}, Financing=${sectionCounts.FINANCING}`);

    // Add default items if sections are empty (should not happen with real data)
    if (operatingItems.length === 0) {
        operatingItems.push({
            label: 'No operating activities found',
            amount: 0,
            flowType: 'inflow',
            indent: 1
        });
    }

    if (investingItems.length === 0) {
        investingItems.push({
            label: 'No investing activities found',
            amount: 0,
            flowType: 'inflow',
            indent: 1
        });
    }

    if (financingItems.length === 0) {
        financingItems.push({
            label: 'No financing activities found',
            amount: 0,
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

    // Calculate totals
    result.netChange = result.operatingTotal + result.investingTotal + result.financingTotal;
    result.cashEnding = result.cashBeginning + result.netChange + result.fxEffects;

    global.logger.logInfo('[CF TRANSFORMER] Transformation complete');
    global.logger.logInfo(`[CF TRANSFORMER] Operating: ${result.operatingTotal.toFixed(2)}`);
    global.logger.logInfo(`[CF TRANSFORMER] Investing: ${result.investingTotal.toFixed(2)}`);
    global.logger.logInfo(`[CF TRANSFORMER] Financing: ${result.financingTotal.toFixed(2)}`);
    global.logger.logInfo(`[CF TRANSFORMER] Net Change: ${result.netChange.toFixed(2)}`);

    return result;
}

module.exports = {
    transformToIFRSCashFlow
};