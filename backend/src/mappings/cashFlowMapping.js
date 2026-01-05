/**
 * NSBU to IFRS Cash Flow Statement Mapping
 * Maps NSBU line items to IFRS Cash Flow Statement format
 * 
 * Based on IAS 7 - Statement of Cash Flows
 * 
 * @version 1.0
 * @date 2025-01-05
 */

const CASH_FLOW_MAPPING = {
    // ============================================
    // OPERATING ACTIVITIES
    // ============================================

    '010': {
        nsbuLine: '010',
        nsbuDescription: 'Cash receipts from customers / Денежные поступления от покупателей',
        ifrsClassification: 'Cash receipts from customers',
        section: 'OPERATING ACTIVITIES',
        flowType: 'inflow',
        directMethod: true
    },
    '020': {
        nsbuLine: '020',
        nsbuDescription: 'Cash paid to suppliers / Денежные выплаты поставщикам',
        ifrsClassification: 'Cash paid to suppliers and employees',
        section: 'OPERATING ACTIVITIES',
        flowType: 'outflow',
        directMethod: true
    },
    '030': {
        nsbuLine: '030',
        nsbuDescription: 'Other operating receipts / Прочие операционные поступления',
        ifrsClassification: 'Other operating receipts',
        section: 'OPERATING ACTIVITIES',
        flowType: 'inflow',
        directMethod: true
    },
    '040': {
        nsbuLine: '040',
        nsbuDescription: 'Tax-related payments / Налоговые платежи',
        ifrsClassification: 'Income taxes paid',
        section: 'OPERATING ACTIVITIES',
        flowType: 'net', // Can be positive or negative
        directMethod: true,
        netCalculation: true // Net of receipts and payments
    },
    '050': {
        nsbuLine: '050',
        nsbuDescription: 'Net cash from operating (subtotal) / Итого операционная деятельность',
        ifrsClassification: 'Operating cash before interest',
        section: 'OPERATING ACTIVITIES',
        flowType: 'subtotal',
        isCalculated: true
    },
    '190': {
        nsbuLine: '190',
        nsbuDescription: 'Interest received / Полученные проценты',
        ifrsClassification: 'Interest received',
        section: 'OPERATING ACTIVITIES',
        flowType: 'inflow',
        directMethod: true
    },
    '200': {
        nsbuLine: '200',
        nsbuDescription: 'Interest paid / Уплаченные проценты',
        ifrsClassification: 'Interest paid',
        section: 'OPERATING ACTIVITIES',
        flowType: 'outflow',
        directMethod: true
    },

    // ============================================
    // INVESTING ACTIVITIES
    // ============================================

    '060': {
        nsbuLine: '060',
        nsbuDescription: 'Sale of property and equipment / Продажа основных средств',
        ifrsClassification: 'Proceeds from property disposals',
        section: 'INVESTING ACTIVITIES',
        flowType: 'inflow'
    },
    '070': {
        nsbuLine: '070',
        nsbuDescription: 'Purchase of property/equipment / Покупка основных средств',
        ifrsClassification: 'Purchase of property and equipment',
        section: 'INVESTING ACTIVITIES',
        flowType: 'outflow'
    },
    '080': {
        nsbuLine: '080',
        nsbuDescription: 'Purchase of intangible assets / Покупка нематериальных активов',
        ifrsClassification: 'Purchase of intangible assets',
        section: 'INVESTING ACTIVITIES',
        flowType: 'outflow'
    },
    '090': {
        nsbuLine: '090',
        nsbuDescription: 'Proceeds from investments / Поступления от инвестиций',
        ifrsClassification: 'Proceeds from investments',
        section: 'INVESTING ACTIVITIES',
        flowType: 'inflow'
    },
    '100': {
        nsbuLine: '100',
        nsbuDescription: 'Purchase of investments / Покупка инвестиций',
        ifrsClassification: 'Purchase of investments',
        section: 'INVESTING ACTIVITIES',
        flowType: 'outflow'
    },

    // ============================================
    // FINANCING ACTIVITIES
    // ============================================

    '110': {
        nsbuLine: '110',
        nsbuDescription: 'Proceeds from borrowings / Поступления от займов',
        ifrsClassification: 'Proceeds from borrowings',
        section: 'FINANCING ACTIVITIES',
        flowType: 'inflow'
    },
    '120': {
        nsbuLine: '120',
        nsbuDescription: 'Repayment of borrowings / Погашение займов',
        ifrsClassification: 'Repayment of borrowings',
        section: 'FINANCING ACTIVITIES',
        flowType: 'outflow'
    },
    '130': {
        nsbuLine: '130',
        nsbuDescription: 'Proceeds from share issuance / Поступления от выпуска акций',
        ifrsClassification: 'Proceeds from share issuance',
        section: 'FINANCING ACTIVITIES',
        flowType: 'inflow'
    },
    '140': {
        nsbuLine: '140',
        nsbuDescription: 'Dividends paid / Выплата дивидендов',
        ifrsClassification: 'Dividends paid',
        section: 'FINANCING ACTIVITIES',
        flowType: 'outflow'
    },
    '150': {
        nsbuLine: '150',
        nsbuDescription: 'Lease payments / Лизинговые платежи',
        ifrsClassification: 'Lease payments',
        section: 'FINANCING ACTIVITIES',
        flowType: 'net', // Can be positive or negative
        netCalculation: true
    },
    '160': {
        nsbuLine: '160',
        nsbuDescription: 'Other financing receipts / Прочие финансовые поступления',
        ifrsClassification: 'Other financing receipts',
        section: 'FINANCING ACTIVITIES',
        flowType: 'inflow'
    },
    '170': {
        nsbuLine: '170',
        nsbuDescription: 'Other financing payments / Прочие финансовые платежи',
        ifrsClassification: 'Other financing payments',
        section: 'FINANCING ACTIVITIES',
        flowType: 'outflow'
    },
    '180': {
        nsbuLine: '180',
        nsbuDescription: 'Net cash from financing / Итого финансовая деятельность',
        ifrsClassification: 'Net cash from financing activities',
        section: 'FINANCING ACTIVITIES',
        flowType: 'subtotal',
        isCalculated: true
    },

    // ============================================
    // RECONCILIATION
    // ============================================

    '220': {
        nsbuLine: '220',
        nsbuDescription: 'Net increase in cash / Чистое изменение денежных средств',
        ifrsClassification: 'Net increase in cash and equivalents',
        section: 'RECONCILIATION',
        flowType: 'total',
        isCalculated: true
    },
    '221': {
        nsbuLine: '221',
        nsbuDescription: 'Foreign exchange effects / Влияние валютных курсов',
        ifrsClassification: 'Effect of exchange rate changes',
        section: 'RECONCILIATION',
        flowType: 'adjustment',
        isIFRSOnly: true // This line may not exist in NSBU format
    },
    '230': {
        nsbuLine: '230',
        nsbuDescription: 'Cash at beginning / Денежные средства на начало',
        ifrsClassification: 'Cash at beginning of period',
        section: 'RECONCILIATION',
        flowType: 'balance'
    },
    '240': {
        nsbuLine: '240',
        nsbuDescription: 'Cash at end / Денежные средства на конец',
        ifrsClassification: 'Cash at end of period',
        section: 'RECONCILIATION',
        flowType: 'balance',
        isCalculated: true
    }
};

/**
 * Get IFRS classification for a given NSBU line
 * @param {string} lineCode - The NSBU line code (e.g., '010', '220')
 * @returns {Object|null} - The mapping object or null if not found
 */
function getCashFlowMapping(lineCode) {
    const code = String(lineCode).padStart(3, '0').trim();
    return CASH_FLOW_MAPPING[code] || null;
}

/**
 * Get all mappings for a specific section
 * @param {string} section - The section name
 * @returns {Array} - Array of mapping objects
 */
function getCashFlowMappingsBySection(section) {
    return Object.values(CASH_FLOW_MAPPING).filter(
        mapping => mapping.section === section
    );
}

/**
 * Get IFRS structure for cash flow statement
 * @returns {Object} - Structured object with sections
 */
function getCashFlowIFRSStructure() {
    return {
        'OPERATING ACTIVITIES': [],
        'INVESTING ACTIVITIES': [],
        'FINANCING ACTIVITIES': [],
        'RECONCILIATION': []
    };
}

module.exports = {
    CASH_FLOW_MAPPING,
    getCashFlowMapping,
    getCashFlowMappingsBySection,
    getCashFlowIFRSStructure
};