/**
 * NSBU to IFRS Balance Sheet Mapping
 * Maps NSBU row codes to IFRS classifications
 * 
 * Row codes are from the standard Uzbek balance sheet format (Form №1 - ОКУД 0710001)
 */

const BALANCE_SHEET_MAPPING = {
    // ============================================
    // ASSETS - NON-CURRENT
    // ============================================
    '010': {
        nsburowCode: '010',
        nsbuCodes: ['0100', '0300'],
        nsbuDescription: 'Fixed Assets - Gross / Первоначальная стоимость',
        ifrsClassification: 'PP&E - Gross Book Value',
        section: 'ASSETS - NON-CURRENT',
        subsection: 'Property, Plant & Equipment'
    },
    '011': {
        nsbuRowCode: '011',
        nsbuCodes: ['0200'],
        nsbuDescription: 'Depreciation / Сумма износа',
        ifrsClassification: 'Accumulated Depreciation',
        section: 'ASSETS - NON-CURRENT',
        subsection: 'Property, Plant & Equipment',
        isNegative: true  // This reduces assets
    },
    '012': {
        nsbuRowCode: '012',
        nsbuCodes: ['calculated'],
        nsbuDescription: 'Net Fixed Assets / Остаточная стоимость',
        ifrsClassification: 'PP&E - Net Book Value',
        section: 'ASSETS - NON-CURRENT',
        subsection: 'Property, Plant & Equipment',
        isCalculated: true  // 010 - 011
    },
    '020': {
        nsbuRowCode: '020',
        nsbuCodes: ['0400'],
        nsbuDescription: 'Intangible Assets - Gross / Нематериальные активы',
        ifrsClassification: 'Intangible Assets - Gross',
        section: 'ASSETS - NON-CURRENT',
        subsection: 'Intangible Assets'
    },
    '021': {
        nsbuRowCode: '021',
        nsbuCodes: ['0500'],
        nsbuDescription: 'Amortization / Сумма амортизации',
        ifrsClassification: 'Accumulated Amortization',
        section: 'ASSETS - NON-CURRENT',
        subsection: 'Intangible Assets',
        isNegative: true
    },
    '022': {
        nsbuRowCode: '022',
        nsbuCodes: ['calculated'],
        nsbuDescription: 'Net Intangible Assets / Остаточная стоимость',
        ifrsClassification: 'Intangible Assets - Net',
        section: 'ASSETS - NON-CURRENT',
        subsection: 'Intangible Assets',
        isCalculated: true  // 020 - 021
    },
    '040': {
        nsbuRowCode: '040',
        nsbuCodes: ['0610'],
        nsbuDescription: 'Securities / Ценные бумаги',
        ifrsClassification: 'Investments - Financial',
        section: 'ASSETS - NON-CURRENT',
        subsection: 'Long-term Investments'
    },
    '050': {
        nsbuRowCode: '050',
        nsbuCodes: ['0620'],
        nsbuDescription: 'Subsidiary Investments / Инвестиции в дочерние общества',
        ifrsClassification: 'Investments in Subsidiaries',
        section: 'ASSETS - NON-CURRENT',
        subsection: 'Long-term Investments'
    },
    '060': {
        nsbuRowCode: '060',
        nsbuCodes: ['0630'],
        nsbuDescription: 'Associated Company Investments / Инвестиции в зависимые общества',
        ifrsClassification: 'Investments in Associates',
        section: 'ASSETS - NON-CURRENT',
        subsection: 'Long-term Investments'
    },
    '070': {
        nsbuRowCode: '070',
        nsbuCodes: ['0640'],
        nsbuDescription: 'Foreign Company Investments / Инвестиции с иностранным капиталом',
        ifrsClassification: 'Investments - Affiliated Co.',
        section: 'ASSETS - NON-CURRENT',
        subsection: 'Long-term Investments'
    },
    '080': {
        nsbuRowCode: '080',
        nsbuCodes: ['0690'],
        nsbuDescription: 'Other Long-term Investments / Прочие долгосрочные инвестиции',
        ifrsClassification: 'Investments - Financial',
        section: 'ASSETS - NON-CURRENT',
        subsection: 'Long-term Investments'
    },
    '090': {
        nsbuRowCode: '090',
        nsbuCodes: ['0700'],
        nsbuDescription: 'Equipment to Install / Оборудование к установке',
        ifrsClassification: 'Equipment to be Installed',
        section: 'ASSETS - NON-CURRENT',
        subsection: 'Construction in Progress'
    },
    '100': {
        nsbuRowCode: '100',
        nsbuCodes: ['0800'],
        nsbuDescription: 'Capital Commitments / Капитальные вложения',
        ifrsClassification: 'Capital Expenditures',
        section: 'ASSETS - NON-CURRENT',
        subsection: 'Construction in Progress'
    },
    '110': {
        nsbuRowCode: '110',
        nsbuCodes: ['0910', '0920', '0930', '0940'],
        nsbuDescription: 'Long-term Receivables / Долгосрочная дебиторская задолженность',
        ifrsClassification: 'Long-term Receivables',
        section: 'ASSETS - NON-CURRENT',
        subsection: 'Other Non-current Assets'
    },
    '120': {
        nsbuRowCode: '120',
        nsbuCodes: ['0950', '0960', '0990'],
        nsbuDescription: 'Long-term Deferred Expenses / Долгосрочные отсроченные расходы',
        ifrsClassification: 'Long-term Deferred Expenses',
        section: 'ASSETS - NON-CURRENT',
        subsection: 'Other Non-current Assets'
    },

    // ============================================
    // ASSETS - CURRENT
    // ============================================
    '150': {
        nsbuRowCode: '150',
        nsbuCodes: ['1000', '1100', '1500', '1600'],
        nsbuDescription: 'Production Supplies / Производственные запасы',
        ifrsClassification: 'Raw Materials & Supplies',
        section: 'ASSETS - CURRENT',
        subsection: 'Inventories'
    },
    '160': {
        nsbuRowCode: '160',
        nsbuCodes: ['2000', '2100', '2300', '2700'],
        nsbuDescription: 'Work in Progress / Незавершенное производство',
        ifrsClassification: 'Work in Progress',
        section: 'ASSETS - CURRENT',
        subsection: 'Inventories'
    },
    '170': {
        nsbuRowCode: '170',
        nsbuCodes: ['2800'],
        nsbuDescription: 'Finished Goods / Готовая продукция',
        ifrsClassification: 'Finished Goods',
        section: 'ASSETS - CURRENT',
        subsection: 'Inventories'
    },
    '180': {
        nsbuRowCode: '180',
        nsbuCodes: ['2900'],  // ex. 2980
        nsbuDescription: 'Trading Goods / Товары',
        ifrsClassification: 'Goods for Resale',
        section: 'ASSETS - CURRENT',
        subsection: 'Inventories'
    },
    '190': {
        nsbuRowCode: '190',
        nsbuCodes: ['3100'],
        nsbuDescription: 'Deferred Expenses / Расходы будущих периодов',
        ifrsClassification: 'Deferred Expenses - Current',
        section: 'ASSETS - CURRENT',
        subsection: 'Prepayments'
    },
    '200': {
        nsbuRowCode: '200',
        nsbuCodes: ['3200'],
        nsbuDescription: 'Other Deferred Expenses / Отсроченные расходы',
        ifrsClassification: 'Other Deferred Expenses',
        section: 'ASSETS - CURRENT',
        subsection: 'Prepayments'
    },
    '220': {
        nsbuRowCode: '220',
        nsbuCodes: ['4000'],  // ex. 4900
        nsbuDescription: 'Customer Receivables / Задолженность покупателей',
        ifrsClassification: 'Trade Receivables - Customers',
        section: 'ASSETS - CURRENT',
        subsection: 'Receivables'
    },
    '230': {
        nsbuRowCode: '230',
        nsbuCodes: ['4110'],
        nsbuDescription: 'Separated Units Due / Задолженность обособленных подразделений',
        ifrsClassification: 'Due from Separated Units',
        section: 'ASSETS - CURRENT',
        subsection: 'Receivables'
    },
    '240': {
        nsbuRowCode: '240',
        nsbuCodes: ['4120'],
        nsbuDescription: 'Subsidiary Due / Задолженность дочерних обществ',
        ifrsClassification: 'Due from Subsidiaries',
        section: 'ASSETS - CURRENT',
        subsection: 'Receivables'
    },
    '250': {
        nsbuRowCode: '250',
        nsbuCodes: ['4200'],
        nsbuDescription: 'Personnel Advances / Авансы персоналу',
        ifrsClassification: 'Advances to Personnel',
        section: 'ASSETS - CURRENT',
        subsection: 'Receivables'
    },
    '260': {
        nsbuRowCode: '260',
        nsbuCodes: ['4300'],
        nsbuDescription: 'Supplier Advances / Авансы поставщикам',
        ifrsClassification: 'Advances to Suppliers',
        section: 'ASSETS - CURRENT',
        subsection: 'Receivables'
    },
    '270': {
        nsbuRowCode: '270',
        nsbuCodes: ['4400'],
        nsbuDescription: 'Tax Advances / Авансовые платежи по налогам',
        ifrsClassification: 'Advance Tax Payments',
        section: 'ASSETS - CURRENT',
        subsection: 'Receivables'
    },
    '280': {
        nsbuRowCode: '280',
        nsbuCodes: ['4500'],
        nsbuDescription: 'Special Fund Advances / Авансовые платежи в фонды',
        ifrsClassification: 'Advances to Special Funds',
        section: 'ASSETS - CURRENT',
        subsection: 'Receivables'
    },
    '290': {
        nsbuRowCode: '290',
        nsbuCodes: ['4600'],
        nsbuDescription: 'Founder Contributions / Задолженность учредителей',
        ifrsClassification: 'Founders\' Capital Calls',
        section: 'ASSETS - CURRENT',
        subsection: 'Receivables'
    },
    '300': {
        nsbuRowCode: '300',
        nsbuCodes: ['4700'],
        nsbuDescription: 'Employee Other Ops / Задолженность персонала по прочим операциям',
        ifrsClassification: 'Employee Other Operations',
        section: 'ASSETS - CURRENT',
        subsection: 'Receivables'
    },
    '310': {
        nsbuRowCode: '310',
        nsbuCodes: ['4800'],
        nsbuDescription: 'Other Receivables / Прочие дебиторские задолженности',
        ifrsClassification: 'Other Trade Receivables',
        section: 'ASSETS - CURRENT',
        subsection: 'Receivables'
    },
    '330': {
        nsbuRowCode: '330',
        nsbuCodes: ['5000'],
        nsbuDescription: 'Cash in Hand / Денежные средства в кассе',
        ifrsClassification: 'Cash - On Hand',
        section: 'ASSETS - CURRENT',
        subsection: 'Cash & Equivalents'
    },
    '340': {
        nsbuRowCode: '340',
        nsbuCodes: ['5100'],
        nsbuDescription: 'Bank Accounts / Денежные средства на расчетном счете',
        ifrsClassification: 'Cash - Bank Accounts',
        section: 'ASSETS - CURRENT',
        subsection: 'Cash & Equivalents'
    },
    '350': {
        nsbuRowCode: '350',
        nsbuCodes: ['5200'],
        nsbuDescription: 'Foreign Currency / Денежные средства в иностранной валюте',
        ifrsClassification: 'Cash - Foreign Currency',
        section: 'ASSETS - CURRENT',
        subsection: 'Cash & Equivalents'
    },
    '360': {
        nsbuRowCode: '360',
        nsbuCodes: ['5500', '5600', '5700'],
        nsbuDescription: 'Other Cash Equiv. / Прочие денежные средства',
        ifrsClassification: 'Cash & Equivalents - Other',
        section: 'ASSETS - CURRENT',
        subsection: 'Cash & Equivalents'
    },
    '370': {
        nsbuRowCode: '370',
        nsbuCodes: ['5800'],
        nsbuDescription: 'Short-term Investments / Краткосрочные инвестиции',
        ifrsClassification: 'Short-term Investments',
        section: 'ASSETS - CURRENT',
        subsection: 'Investments'
    },
    '380': {
        nsbuRowCode: '380',
        nsbuCodes: ['5900'],
        nsbuDescription: 'Other Current Assets / Прочие текущие активы',
        ifrsClassification: 'Other Current Assets',
        section: 'ASSETS - CURRENT',
        subsection: 'Other'
    },

    // ============================================
    // EQUITY
    // ============================================
    '410': {
        nsbuRowCode: '410',
        nsbuCodes: ['8300'],
        nsbuDescription: 'Charter Capital / Уставный капитал',
        ifrsClassification: 'Share Capital',
        section: 'EQUITY',
        subsection: 'Capital'
    },
    '420': {
        nsbuRowCode: '420',
        nsbuCodes: ['8400'],
        nsbuDescription: 'Additional Capital / Добавленный капитал',
        ifrsClassification: 'Share Premium/Additional Capital',
        section: 'EQUITY',
        subsection: 'Capital'
    },
    '430': {
        nsbuRowCode: '430',
        nsbuCodes: ['8500'],
        nsbuDescription: 'Reserve Capital / Резервный капитал',
        ifrsClassification: 'Reserve Capital',
        section: 'EQUITY',
        subsection: 'Reserves'
    },
    '440': {
        nsbuRowCode: '440',
        nsbuCodes: ['8600'],
        nsbuDescription: 'Treasury Shares / Выкупленные собственные акции',
        ifrsClassification: 'Treasury Shares/Own Shares',
        section: 'EQUITY',
        subsection: 'Capital',
        isNegative: true  // Reduces equity
    },
    '450': {
        nsbuRowCode: '450',
        nsbuCodes: ['8700'],
        nsbuDescription: 'Retained Earnings / Нераспределенная прибыль',
        ifrsClassification: 'Retained Earnings/(Losses)',
        section: 'EQUITY',
        subsection: 'Retained Earnings'
    },
    '460': {
        nsbuRowCode: '460',
        nsbuCodes: ['8800'],
        nsbuDescription: 'Targeted Funds / Целевые поступления',
        ifrsClassification: 'Targeted Funds',
        section: 'EQUITY',
        subsection: 'Reserves'
    },
    '470': {
        nsbuRowCode: '470',
        nsbuCodes: ['8900'],
        nsbuDescription: 'Deferred Reserves / Резервы предстоящих расходов',
        ifrsClassification: 'Reserves for Future Expenses',
        section: 'EQUITY',
        subsection: 'Reserves'
    },

    // ============================================
    // LIABILITIES - NON-CURRENT
    // ============================================
    '500': {
        nsbuRowCode: '500',
        nsbuCodes: ['7000'],
        nsbuDescription: 'LT Suppliers Payable / Долгосрочная задолженность поставщикам',
        ifrsClassification: 'LT Supplier Payables',
        section: 'LIABILITIES - NON-CURRENT',
        subsection: 'Long-term Payables'
    },
    '510': {
        nsbuRowCode: '510',
        nsbuCodes: ['7110'],
        nsbuDescription: 'LT Separated Units Due / Долгосрочная задолженность подразделениям',
        ifrsClassification: 'LT Due to Separated Units',
        section: 'LIABILITIES - NON-CURRENT',
        subsection: 'Long-term Payables'
    },
    '520': {
        nsbuRowCode: '520',
        nsbuCodes: ['7120'],
        nsbuDescription: 'LT Subsidiary Due / Долгосрочная задолженность дочерним обществам',
        ifrsClassification: 'LT Due to Subsidiaries',
        section: 'LIABILITIES - NON-CURRENT',
        subsection: 'Long-term Payables'
    },
    '530': {
        nsbuRowCode: '530',
        nsbuCodes: ['7210', '7220', '7230'],
        nsbuDescription: 'LT Deferred Income / Долгосрочные отсроченные доходы',
        ifrsClassification: 'LT Deferred Income',
        section: 'LIABILITIES - NON-CURRENT',
        subsection: 'Deferred Items'
    },
    '540': {
        nsbuRowCode: '540',
        nsbuCodes: ['7240'],
        nsbuDescription: 'LT Deferred Tax Liab. / Долгосрочные отсроченные обязательства по налогам',
        ifrsClassification: 'LT Deferred Tax Liabilities',
        section: 'LIABILITIES - NON-CURRENT',
        subsection: 'Deferred Items'
    },
    '550': {
        nsbuRowCode: '550',
        nsbuCodes: ['7250', '7290'],
        nsbuDescription: 'LT Other Deferred Liab. / Прочие долгосрочные отсроченные обязательства',
        ifrsClassification: 'LT Other Deferred Liabilities',
        section: 'LIABILITIES - NON-CURRENT',
        subsection: 'Deferred Items'
    },
    '560': {
        nsbuRowCode: '560',
        nsbuCodes: ['7300'],
        nsbuDescription: 'LT Customer Advances / Авансы от покупателей',
        ifrsClassification: 'LT Advances from Customers',
        section: 'LIABILITIES - NON-CURRENT',
        subsection: 'Long-term Payables'
    },
    '570': {
        nsbuRowCode: '570',
        nsbuCodes: ['7810'],
        nsbuDescription: 'LT Bank Credits / Долгосрочные банковские кредиты',
        ifrsClassification: 'LT Bank Credits/Loans',
        section: 'LIABILITIES - NON-CURRENT',
        subsection: 'Borrowings'
    },
    '580': {
        nsbuRowCode: '580',
        nsbuCodes: ['7820', '7830', '7840'],
        nsbuDescription: 'LT Other Borrowings / Долгосрочные займы',
        ifrsClassification: 'LT Other Loans & Borrowings',
        section: 'LIABILITIES - NON-CURRENT',
        subsection: 'Borrowings'
    },
    '590': {
        nsbuRowCode: '590',
        nsbuCodes: ['7900'],
        nsbuDescription: 'LT Other Liabilities / Прочие долгосрочные обязательства',
        ifrsClassification: 'LT Other Liabilities',
        section: 'LIABILITIES - NON-CURRENT',
        subsection: 'Other'
    },

    // ============================================
    // LIABILITIES - CURRENT
    // ============================================
    '610': {
        nsbuRowCode: '610',
        nsbuCodes: ['6000'],
        nsbuDescription: 'ST Suppliers Payable / Задолженность поставщикам',
        ifrsClassification: 'ST Supplier Payables',
        section: 'LIABILITIES - CURRENT',
        subsection: 'Trade Payables'
    },
    '620': {
        nsbuRowCode: '620',
        nsbuCodes: ['6110'],
        nsbuDescription: 'ST Separated Units Due / Задолженность подразделениям',
        ifrsClassification: 'ST Due to Separated Units',
        section: 'LIABILITIES - CURRENT',
        subsection: 'Trade Payables'
    },
    '630': {
        nsbuRowCode: '630',
        nsbuCodes: ['6120'],
        nsbuDescription: 'ST Subsidiary Due / Задолженность дочерним обществам',
        ifrsClassification: 'ST Due to Subsidiaries',
        section: 'LIABILITIES - CURRENT',
        subsection: 'Trade Payables'
    },
    '640': {
        nsbuRowCode: '640',
        nsbuCodes: ['6210', '6220', '6230'],
        nsbuDescription: 'ST Deferred Income / Отсроченные доходы',
        ifrsClassification: 'ST Deferred Income',
        section: 'LIABILITIES - CURRENT',
        subsection: 'Deferred Items'
    },
    '650': {
        nsbuRowCode: '650',
        nsbuCodes: ['6240'],
        nsbuDescription: 'ST Deferred Tax Liab. / Отсроченные обязательства по налогам',
        ifrsClassification: 'ST Deferred Tax Liabilities',
        section: 'LIABILITIES - CURRENT',
        subsection: 'Deferred Items'
    },
    '660': {
        nsbuRowCode: '660',
        nsbuCodes: ['6250', '6290'],
        nsbuDescription: 'ST Other Deferred Liab. / Прочие отсроченные обязательства',
        ifrsClassification: 'ST Other Deferred Liabilities',
        section: 'LIABILITIES - CURRENT',
        subsection: 'Deferred Items'
    },
    '670': {
        nsbuRowCode: '670',
        nsbuCodes: ['6300'],
        nsbuDescription: 'ST Customer Advances / Полученные авансы',
        ifrsClassification: 'ST Advances from Customers',
        section: 'LIABILITIES - CURRENT',
        subsection: 'Trade Payables'
    },
    '680': {
        nsbuRowCode: '680',
        nsbuCodes: ['6400'],
        nsbuDescription: 'ST Tax Payables / Задолженность по платежам в бюджет',
        ifrsClassification: 'ST Tax & Duty Payables',
        section: 'LIABILITIES - CURRENT',
        subsection: 'Other Payables'
    },
    '690': {
        nsbuRowCode: '690',
        nsbuCodes: ['6510'],
        nsbuDescription: 'ST Insurance Payables / Задолженность по страхованию',
        ifrsClassification: 'ST Insurance Payables',
        section: 'LIABILITIES - CURRENT',
        subsection: 'Other Payables'
    },
    '700': {
        nsbuRowCode: '700',
        nsbuCodes: ['6520'],
        nsbuDescription: 'ST Social Fund Payables / Задолженность в фонды',
        ifrsClassification: 'ST Social Fund Payables',
        section: 'LIABILITIES - CURRENT',
        subsection: 'Other Payables'
    },
    '710': {
        nsbuRowCode: '710',
        nsbuCodes: ['6600'],
        nsbuDescription: 'ST Dividend Payables / Задолженность учредителям',
        ifrsClassification: 'ST Dividend Payables',
        section: 'LIABILITIES - CURRENT',
        subsection: 'Other Payables'
    },
    '720': {
        nsbuRowCode: '720',
        nsbuCodes: ['6700'],
        nsbuDescription: 'ST Employee Payables / Задолженность по оплате труда',
        ifrsClassification: 'ST Employee Payables',
        section: 'LIABILITIES - CURRENT',
        subsection: 'Other Payables'
    },
    '730': {
        nsbuRowCode: '730',
        nsbuCodes: ['6810'],
        nsbuDescription: 'ST Bank Credits / Краткосрочные банковские кредиты',
        ifrsClassification: 'ST Bank Credits/Loans',
        section: 'LIABILITIES - CURRENT',
        subsection: 'Borrowings'
    },
    '740': {
        nsbuRowCode: '740',
        nsbuCodes: ['6820', '6830', '6840'],
        nsbuDescription: 'ST Other Loans / Краткосрочные займы',
        ifrsClassification: 'ST Other Loans',
        section: 'LIABILITIES - CURRENT',
        subsection: 'Borrowings'
    },
    '750': {
        nsbuRowCode: '750',
        nsbuCodes: ['6950'],
        nsbuDescription: 'Current Portion LT Debt / Текущая часть долгосрочных обязательств',
        ifrsClassification: 'Current Portion of LT Debt',
        section: 'LIABILITIES - CURRENT',
        subsection: 'Borrowings'
    },
    '760': {
        nsbuRowCode: '760',
        nsbuCodes: ['6900'],  // ex. 6950
        nsbuDescription: 'ST Other Liabilities / Прочие кредиторские задолженности',
        ifrsClassification: 'ST Other Liabilities',
        section: 'LIABILITIES - CURRENT',
        subsection: 'Other Payables'
    }
};

// Section totals - for reference and validation
const SECTION_TOTALS = {
    '130': 'Total Non-current Assets',
    '390': 'Total Current Assets',
    '400': 'Total Assets',
    '480': 'Total Equity',
    '490': 'Total Non-current Liabilities',
    '600': 'Total Current Liabilities',
    '770': 'Total Liabilities',
    '780': 'Total Equity and Liabilities'
};

/**
 * Get IFRS classification for a given NSBU row code
 */
function getIFRSMapping(rowCode) {
    const code = String(rowCode).trim();
    return BALANCE_SHEET_MAPPING[code] || null;
}

/**
 * Get all mappings for a specific section
 */
function getMappingsBySection(section) {
    return Object.values(BALANCE_SHEET_MAPPING).filter(
        mapping => mapping.section === section
    );
}

/**
 * Get subsection structure for organizing the IFRS balance sheet
 */
function getIFRSStructure() {
    const structure = {
        'ASSETS - NON-CURRENT': {},
        'ASSETS - CURRENT': {},
        'EQUITY': {},
        'LIABILITIES - NON-CURRENT': {},
        'LIABILITIES - CURRENT': {}
    };

    Object.values(BALANCE_SHEET_MAPPING).forEach(mapping => {
        if (!structure[mapping.section][mapping.subsection]) {
            structure[mapping.section][mapping.subsection] = [];
        }
        structure[mapping.section][mapping.subsection].push(mapping);
    });

    return structure;
}

module.exports = {
    BALANCE_SHEET_MAPPING,
    SECTION_TOTALS,
    getIFRSMapping,
    getMappingsBySection,
    getIFRSStructure
};