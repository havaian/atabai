// transformers/cashFlow.js

/**
 * Cash Flow Transformer - Maps Uzbek CF format to IFRS structure
 * Handles Russian line item names and creates IFRS-compliant sections
 */

// Mapping of Russian line items to IFRS line items
const LINE_ITEM_MAPPING = {
    // Operating Activities - Inflows
    'Реализация продукции и товаров': 'Cash receipts from sale of goods',
    'Реализация услуг': 'Cash receipts from rendering of services',
    'Прочая выручка': 'Other operating receipts',
    'Авансы полученные': 'Advances received from customers',
    'Прочие поступления': 'Other cash receipts',
    'Возврат НДС': 'VAT refunds received',
    'Приток': 'Cash generated from operations',

    // Operating Activities - Outflows
    'Платежи поставщикам за товары и услуги': 'Cash paid to suppliers',
    'Авансы выданные': 'Advances paid',
    'Выплаты по заработной плате': 'Cash paid to employees',
    'Налог на прибыль': 'Income taxes paid',
    'Другие платежи в бюджет': 'Other taxes paid',
    'Выплаты по краткосрочной аренде': 'Cash paid for short-term leases',
    'Прочие выплаты': 'Other operating payments',
    'Отток': 'Cash used in operations',
    'ВГО': 'VAT and other payments',

    // Investing Activities - Inflows
    'От продажи основных средств': 'Proceeds from sale of property, plant and equipment',
    'Продажа недвижимого имущества': 'Proceeds from sale of real estate',
    'Продажа спец.техники': 'Proceeds from sale of equipment',
    'Дивиденды полученные': 'Dividends received',
    'Проценты полученные': 'Interest received',
    'Притоки': 'Cash from investing activities',

    // Investing Activities - Outflows
    'Приобретение зданий и сооружений': 'Purchase of buildings and structures',
    'Приобретение строительных машин': 'Purchase of construction equipment',
    'Приобретение транспорта': 'Purchase of vehicles',
    'Приобретение основных средств': 'Purchase of property, plant and equipment',
    'Приобретение нематериальных активов': 'Purchase of intangible assets',
    'Займы выданные': 'Loans granted',

    // Financing Activities - Inflows
    'Поступления от эмиссии акций': 'Proceeds from issuance of shares',
    'Кредиты и займы полученные': 'Proceeds from borrowings',
    'Целевое финансирование': 'Proceeds from grants',

    // Financing Activities - Outflows
    'Погашение кредитов и займов': 'Repayment of borrowings',
    'Выплата дивидендов': 'Dividends paid',
    'Проценты уплаченные': 'Interest paid',
    'Погашение обязательств по аренде': 'Payment of lease liabilities'
};

function transformToIFRSCashFlow(dataMap) {
    console.log('[CF TRANSFORMER] Starting transformation...');
    console.log(`[CF TRANSFORMER] Input items: ${dataMap.size}`);

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

    for (const [key, data] of dataMap.entries()) {
        const ifrsLabel = LINE_ITEM_MAPPING[key] || key;

        const item = {
            label: ifrsLabel,
            amount: data.total,
            flowType: data.isOutflow ? 'outflow' : 'inflow',
            indent: 1
        };

        // Add sub-item markers for detail lines
        if (data.subSection) {
            item.indent = 2;
            item.isSubItem = true;
        }

        // Route to appropriate section
        if (data.section === 'OPERATING') {
            operatingItems.push(item);
            result.operatingTotal += data.total;
        } else if (data.section === 'INVESTING') {
            investingItems.push(item);
            result.investingTotal += data.total;
        } else if (data.section === 'FINANCING') {
            financingItems.push(item);
            result.financingTotal += data.total;
        }

        console.log(`[CF TRANSFORMER] Mapped: ${key} → ${ifrsLabel} (${data.total.toFixed(2)})`);
    }

    // Add default items if sections are empty
    if (operatingItems.length === 0) {
        operatingItems.push({
            label: 'Cash generated from operations',
            amount: 0,
            flowType: 'inflow',
            indent: 1
        });
        operatingItems.push({
            label: 'Income taxes paid',
            amount: 0,
            flowType: 'outflow',
            indent: 1
        });
    }

    if (investingItems.length === 0) {
        investingItems.push({
            label: 'Purchase of property, plant and equipment',
            amount: 0,
            flowType: 'outflow',
            indent: 1
        });
    }

    if (financingItems.length === 0) {
        financingItems.push({
            label: 'Proceeds from borrowings',
            amount: 0,
            flowType: 'inflow',
            indent: 1
        });
        financingItems.push({
            label: 'Repayment of borrowings',
            amount: 0,
            flowType: 'outflow',
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

    console.log('[CF TRANSFORMER] Transformation complete');
    console.log(`[CF TRANSFORMER] Operating: ${result.operatingTotal.toFixed(2)}`);
    console.log(`[CF TRANSFORMER] Investing: ${result.investingTotal.toFixed(2)}`);
    console.log(`[CF TRANSFORMER] Financing: ${result.financingTotal.toFixed(2)}`);
    console.log(`[CF TRANSFORMER] Net Change: ${result.netChange.toFixed(2)}`);

    return result;
}

module.exports = {
    transformToIFRSCashFlow
};