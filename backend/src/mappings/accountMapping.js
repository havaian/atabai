/**
 * NSBU to IFRS Balance Sheet Mapping - COMPREHENSIVE VERSION
 * Maps NSBU row codes to IFRS classifications
 * 
 * Row codes are from the standard Uzbek balance sheet format (Form №1 - ОКУД 0710001)
 * Updated to match complete NSBU 21 chart of accounts mapping
 * 
 * @version 2.0
 * @date 2025-01-XX
 */

const BALANCE_SHEET_MAPPING = {
    // ============================================
    // ASSETS - NON-CURRENT
    // ============================================
    
    // PROPERTY, PLANT & EQUIPMENT
    '010': {
        nsbuRowCode: '010',
        nsbuCodes: ['0100', '0300'],
        nsbuDescription: 'Fixed Assets - Gross / Первоначальная стоимость основных средств',
        ifrsClassification: 'PP&E - Gross Book Value',
        section: 'ASSETS - NON-CURRENT',
        subsection: 'Property, Plant & Equipment',
        accountDetails: {
            '0100': 'Fixed Assets (various sub-accounts 0110-0199)',
            '0300': 'Finance Lease Assets'
        }
    },
    '011': {
        nsbuRowCode: '011',
        nsbuCodes: ['0200'],
        nsbuDescription: 'Depreciation / Сумма износа основных средств',
        ifrsClassification: 'Accumulated Depreciation',
        section: 'ASSETS - NON-CURRENT',
        subsection: 'Property, Plant & Equipment',
        isNegative: true,
        accountDetails: {
            '0200': 'Accumulated Depreciation (various sub-accounts 0211-0299)'
        }
    },
    '012': {
        nsbuRowCode: '012',
        nsbuCodes: ['calculated'],
        nsbuDescription: 'Net Fixed Assets / Остаточная стоимость основных средств',
        ifrsClassification: 'PP&E - Net Book Value',
        section: 'ASSETS - NON-CURRENT',
        subsection: 'Property, Plant & Equipment',
        isCalculated: true,
        formula: '010 - 011'
    },
    
    // INTANGIBLE ASSETS
    '020': {
        nsbuRowCode: '020',
        nsbuCodes: ['0400'],
        nsbuDescription: 'Intangible Assets - Gross / Первоначальная стоимость нематериальных активов',
        ifrsClassification: 'Intangible Assets - Gross',
        section: 'ASSETS - NON-CURRENT',
        subsection: 'Intangible Assets',
        accountDetails: {
            '0400': 'Intangible Assets (sub-accounts: 0410-Patents, 0420-Trademarks, 0430-Software, 0440-Land Rights, 0460-Franchise, 0470-Copyrights, 0480-Goodwill, 0490-Other)'
        }
    },
    '021': {
        nsbuRowCode: '021',
        nsbuCodes: ['0500'],
        nsbuDescription: 'Amortization / Сумма амортизации нематериальных активов',
        ifrsClassification: 'Accumulated Amortization',
        section: 'ASSETS - NON-CURRENT',
        subsection: 'Intangible Assets',
        isNegative: true,
        accountDetails: {
            '0500': 'Accumulated Amortization (sub-accounts 0510-0590)'
        }
    },
    '022': {
        nsbuRowCode: '022',
        nsbuCodes: ['calculated'],
        nsbuDescription: 'Net Intangible Assets / Остаточная стоимость нематериальных активов',
        ifrsClassification: 'Intangible Assets - Net',
        section: 'ASSETS - NON-CURRENT',
        subsection: 'Intangible Assets',
        isCalculated: true,
        formula: '020 - 021'
    },
    
    // LONG-TERM INVESTMENTS
    '040': {
        nsbuRowCode: '040',
        nsbuCodes: ['0610'],
        nsbuDescription: 'Securities / Ценные бумаги',
        ifrsClassification: 'Investment Securities',
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
        nsbuDescription: 'Foreign Company Investments / Инвестиции в организации с иностранным капиталом',
        ifrsClassification: 'Investments in Foreign Entities',
        section: 'ASSETS - NON-CURRENT',
        subsection: 'Long-term Investments'
    },
    '080': {
        nsbuRowCode: '080',
        nsbuCodes: ['0690'],
        nsbuDescription: 'Other Long-term Investments / Прочие долгосрочные инвестиции',
        ifrsClassification: 'Other Non-Current Investments',
        section: 'ASSETS - NON-CURRENT',
        subsection: 'Long-term Investments'
    },
    
    // CONSTRUCTION IN PROGRESS
    '090': {
        nsbuRowCode: '090',
        nsbuCodes: ['0700', '0710', '0720'],
        nsbuDescription: 'Equipment to Install / Оборудование к установке',
        ifrsClassification: 'Equipment to be Installed',
        section: 'ASSETS - NON-CURRENT',
        subsection: 'Construction in Progress',
        accountDetails: {
            '0710': 'Equipment to Install - Domestic',
            '0720': 'Equipment to Install - Imported'
        }
    },
    '100': {
        nsbuRowCode: '100',
        nsbuCodes: ['0800', '0810', '0820', '0830', '0840', '0850', '0860', '0890'],
        nsbuDescription: 'Capital Investments / Капитальные вложения',
        ifrsClassification: 'Capital Expenditures',
        section: 'ASSETS - NON-CURRENT',
        subsection: 'Construction in Progress',
        accountDetails: {
            '0810': 'Construction in Progress',
            '0820': 'PPE under Acquisition',
            '0830': 'Intangibles under Acquisition',
            '0840': 'Breeding Livestock Development',
            '0850': 'Land Improvement CIP',
            '0860': 'Leasehold Improvements CIP',
            '0890': 'Other Capital Expenditures'
        }
    },
    
    // OTHER NON-CURRENT ASSETS
    '110': {
        nsbuRowCode: '110',
        nsbuCodes: ['0910', '0920', '0930', '0940'],
        nsbuDescription: 'Long-term Receivables / Долгосрочная дебиторская задолженность',
        ifrsClassification: 'Long-term Receivables',
        section: 'ASSETS - NON-CURRENT',
        subsection: 'Other Non-current Assets',
        accountDetails: {
            '0910': 'Long-term Notes Receivable',
            '0920': 'Finance Lease Receivables',
            '0930': 'Long-term Employee Receivables',
            '0940': 'Other Non-Current Receivables'
        }
    },
    '120': {
        nsbuRowCode: '120',
        nsbuCodes: ['0950', '0960', '0990'],
        nsbuDescription: 'Long-term Prepaid Expenses / Долгосрочные расходы будущих периодов',
        ifrsClassification: 'Long-term Prepaid Expenses',
        section: 'ASSETS - NON-CURRENT',
        subsection: 'Other Non-current Assets',
        accountDetails: {
            '0950': 'Deferred Tax Assets',
            '0960': 'Long-term Prepaid Expenses',
            '0990': 'Other Long-term Deferrals'
        }
    },

    // ============================================
    // ASSETS - CURRENT
    // ============================================
    
    // INVENTORIES
    '150': {
        nsbuRowCode: '150',
        nsbuCodes: ['1000', '1010', '1020', '1030', '1040', '1050', '1060', '1070', '1080', '1090', 
                    '1100', '1110', '1120', '1500', '1510', '1600', '1610'],
        nsbuDescription: 'Production Supplies / Производственные запасы',
        ifrsClassification: 'Raw Materials & Supplies',
        section: 'ASSETS - CURRENT',
        subsection: 'Inventories',
        accountDetails: {
            '1000': 'Materials (main account)',
            '1010': 'Raw Materials',
            '1020': 'Purchased Components',
            '1030': 'Fuel',
            '1040': 'Spare Parts',
            '1050': 'Construction Materials',
            '1060': 'Packaging Materials',
            '1070': 'Materials Sent for Processing',
            '1080': 'Supplies & Accessories',
            '1090': 'Other Materials',
            '1100': 'Biological Assets - Livestock',
            '1110': 'Growing Livestock',
            '1120': 'Fattening Livestock',
            '1500': 'Materials in Transit',
            '1510': 'Materials Procurement',
            '1600': 'Material Price Variance',
            '1610': 'Material Cost Variance'
        }
    },
    '160': {
        nsbuRowCode: '160',
        nsbuCodes: ['2000', '2010', '2100', '2110', '2300', '2310', '2700', '2710'],
        nsbuDescription: 'Work in Progress / Незавершенное производство',
        ifrsClassification: 'Work in Progress',
        section: 'ASSETS - CURRENT',
        subsection: 'Inventories',
        accountDetails: {
            '2000': 'Main Production WIP',
            '2010': 'Main Production',
            '2100': 'Semi-finished Goods',
            '2110': 'Self-produced Semi-finished Goods',
            '2300': 'Auxiliary Production',
            '2310': 'Auxiliary Production',
            '2700': 'Service Operations',
            '2710': 'Service Facilities'
        }
    },
    '170': {
        nsbuRowCode: '170',
        nsbuCodes: ['2800', '2810', '2820', '2830'],
        nsbuDescription: 'Finished Goods / Готовая продукция',
        ifrsClassification: 'Finished Goods Inventory',
        section: 'ASSETS - CURRENT',
        subsection: 'Inventories',
        accountDetails: {
            '2810': 'Finished Goods in Warehouse',
            '2820': 'Finished Goods on Exhibition',
            '2830': 'Finished Goods on Consignment'
        }
    },
    '180': {
        nsbuRowCode: '180',
        nsbuCodes: ['2900', '2910', '2920', '2930', '2940', '2950', '2960', '2970', '2990'],
        nsbuDescription: 'Trading Goods / Товары',
        ifrsClassification: 'Goods for Resale',
        section: 'ASSETS - CURRENT',
        subsection: 'Inventories',
        excludedAccounts: ['2980'],  // Trade Markup is a contra-asset
        accountDetails: {
            '2910': 'Merchandise in Warehouse',
            '2920': 'Merchandise in Retail',
            '2930': 'Merchandise on Exhibition',
            '2940': 'Rental Items',
            '2950': 'Packaging & Containers',
            '2960': 'Goods on Consignment',
            '2970': 'Goods in Transit',
            '2990': 'Other Merchandise'
        }
    },
    
    // PREPAYMENTS & DEFERRALS
    '190': {
        nsbuRowCode: '190',
        nsbuCodes: ['3100', '3110', '3120', '3190'],
        nsbuDescription: 'Prepaid Expenses / Расходы будущих периодов',
        ifrsClassification: 'Prepaid Expenses - Current',
        section: 'ASSETS - CURRENT',
        subsection: 'Prepayments',
        accountDetails: {
            '3110': 'Prepaid Operating Lease',
            '3120': 'Prepaid Services',
            '3190': 'Other Prepaid Expenses'
        }
    },
    '200': {
        nsbuRowCode: '200',
        nsbuCodes: ['3200', '3210', '3220', '3290'],
        nsbuDescription: 'Deferred Expenses / Отсроченные расходы',
        ifrsClassification: 'Deferred Expenses - Current',
        section: 'ASSETS - CURRENT',
        subsection: 'Prepayments',
        accountDetails: {
            '3210': 'Deferred Tax Assets - Current',
            '3220': 'Deferred Discount Expenses',
            '3290': 'Other Deferred Expenses'
        }
    },
    
    // RECEIVABLES
    '220': {
        nsbuRowCode: '220',
        nsbuCodes: ['4000', '4010', '4020'],
        nsbuDescription: 'Customer Receivables / Задолженность покупателей и заказчиков',
        ifrsClassification: 'Trade Receivables - Customers',
        section: 'ASSETS - CURRENT',
        subsection: 'Receivables',
        excludedAccounts: ['4900'],  // Allowance for Doubtful Accounts
        accountDetails: {
            '4010': 'Accounts Receivable - Customers',
            '4020': 'Notes Receivable'
        }
    },
    '230': {
        nsbuRowCode: '230',
        nsbuCodes: ['4110'],
        nsbuDescription: 'Separated Units Due / Задолженность обособленных подразделений',
        ifrsClassification: 'Receivables from Branches',
        section: 'ASSETS - CURRENT',
        subsection: 'Receivables'
    },
    '240': {
        nsbuRowCode: '240',
        nsbuCodes: ['4120'],
        nsbuDescription: 'Subsidiary Due / Задолженность дочерних обществ',
        ifrsClassification: 'Receivables from Subsidiaries',
        section: 'ASSETS - CURRENT',
        subsection: 'Receivables'
    },
    '250': {
        nsbuRowCode: '250',
        nsbuCodes: ['4200', '4210', '4220', '4230', '4290'],
        nsbuDescription: 'Personnel Advances / Авансы, выданные персоналу',
        ifrsClassification: 'Advances to Personnel',
        section: 'ASSETS - CURRENT',
        subsection: 'Receivables',
        accountDetails: {
            '4210': 'Salary Advances',
            '4220': 'Travel Advances',
            '4230': 'Administrative Expense Advances',
            '4290': 'Other Employee Advances'
        }
    },
    '260': {
        nsbuRowCode: '260',
        nsbuCodes: ['4300', '4310', '4320', '4330'],
        nsbuDescription: 'Supplier Advances / Авансы, выданные поставщикам',
        ifrsClassification: 'Advances to Suppliers',
        section: 'ASSETS - CURRENT',
        subsection: 'Receivables',
        accountDetails: {
            '4310': 'Advances for Inventory',
            '4320': 'Advances for Non-Current Assets',
            '4330': 'Other Advances Paid'
        }
    },
    '270': {
        nsbuRowCode: '270',
        nsbuCodes: ['4400', '4410'],
        nsbuDescription: 'Tax Advances / Авансовые платежи по налогам',
        ifrsClassification: 'Advance Tax Payments',
        section: 'ASSETS - CURRENT',
        subsection: 'Receivables',
        accountDetails: {
            '4410': 'Prepaid Taxes'
        }
    },
    '280': {
        nsbuRowCode: '280',
        nsbuCodes: ['4500', '4510', '4520'],
        nsbuDescription: 'Insurance & Fund Advances / Авансы по страхованию и в фонды',
        ifrsClassification: 'Prepaid Insurance & Fund Contributions',
        section: 'ASSETS - CURRENT',
        subsection: 'Receivables',
        accountDetails: {
            '4510': 'Prepaid Insurance',
            '4520': 'Prepaid State Fund Contributions'
        }
    },
    '290': {
        nsbuRowCode: '290',
        nsbuCodes: ['4600', '4610'],
        nsbuDescription: 'Founder Contributions / Задолженность учредителей по вкладам',
        ifrsClassification: 'Subscriptions Receivable',
        section: 'ASSETS - CURRENT',
        subsection: 'Receivables',
        accountDetails: {
            '4610': 'Subscriptions Receivable'
        }
    },
    '300': {
        nsbuRowCode: '300',
        nsbuCodes: ['4700', '4710', '4720', '4730', '4790'],
        nsbuDescription: 'Employee Other Operations / Задолженность персонала по прочим операциям',
        ifrsClassification: 'Other Employee Receivables',
        section: 'ASSETS - CURRENT',
        subsection: 'Receivables',
        accountDetails: {
            '4710': 'Employee Credit Sales',
            '4720': 'Loans to Employees',
            '4730': 'Receivables for Damages',
            '4790': 'Other Employee Receivables'
        }
    },
    '310': {
        nsbuRowCode: '310',
        nsbuCodes: ['4800', '4810', '4820', '4830', '4840', '4850', '4860', '4890'],
        nsbuDescription: 'Other Receivables / Прочая дебиторская задолженность',
        ifrsClassification: 'Other Current Receivables',
        section: 'ASSETS - CURRENT',
        subsection: 'Receivables',
        accountDetails: {
            '4810': 'Finance Lease Receivables - Current',
            '4820': 'Operating Lease Receivables',
            '4830': 'Interest Receivable',
            '4840': 'Dividends Receivable',
            '4850': 'Royalties Receivable',
            '4860': 'Claims Receivable',
            '4890': 'Other Receivables'
        }
    },
    
    // CASH & CASH EQUIVALENTS
    '330': {
        nsbuRowCode: '330',
        nsbuCodes: ['5000', '5010', '5020'],
        nsbuDescription: 'Cash in Hand / Денежные средства в кассе',
        ifrsClassification: 'Cash on Hand',
        section: 'ASSETS - CURRENT',
        subsection: 'Cash & Equivalents',
        accountDetails: {
            '5010': 'Cash - Local Currency',
            '5020': 'Cash - Foreign Currency'
        }
    },
    '340': {
        nsbuRowCode: '340',
        nsbuCodes: ['5100', '5110'],
        nsbuDescription: 'Bank Current Account / Денежные средства на расчетном счете',
        ifrsClassification: 'Cash at Bank - Current Account',
        section: 'ASSETS - CURRENT',
        subsection: 'Cash & Equivalents',
        accountDetails: {
            '5110': 'Current Bank Account'
        }
    },
    '350': {
        nsbuRowCode: '350',
        nsbuCodes: ['5200', '5210', '5220'],
        nsbuDescription: 'Foreign Currency Accounts / Денежные средства в иностранной валюте',
        ifrsClassification: 'Cash at Bank - Foreign Currency',
        section: 'ASSETS - CURRENT',
        subsection: 'Cash & Equivalents',
        accountDetails: {
            '5210': 'Foreign Currency - Domestic Bank',
            '5220': 'Foreign Currency - Foreign Bank'
        }
    },
    '360': {
        nsbuRowCode: '360',
        nsbuCodes: ['5500', '5510', '5520', '5530', '5600', '5610', '5700', '5710'],
        nsbuDescription: 'Other Cash & Equivalents / Прочие денежные средства',
        ifrsClassification: 'Cash & Equivalents - Other',
        section: 'ASSETS - CURRENT',
        subsection: 'Cash & Equivalents',
        accountDetails: {
            '5510': 'Letters of Credit',
            '5520': 'Checkbooks',
            '5530': 'Other Special Accounts',
            '5610': 'Cash Equivalents (by type)',
            '5710': 'Cash/Transfers in Transit'
        }
    },
    
    // SHORT-TERM INVESTMENTS & OTHER
    '370': {
        nsbuRowCode: '370',
        nsbuCodes: ['5800', '5810', '5830', '5890'],
        nsbuDescription: 'Short-term Investments / Краткосрочные инвестиции',
        ifrsClassification: 'Current Financial Assets',
        section: 'ASSETS - CURRENT',
        subsection: 'Investments',
        accountDetails: {
            '5810': 'Marketable Securities',
            '5830': 'Short-term Loans Receivable',
            '5890': 'Other Current Investments'
        }
    },
    '380': {
        nsbuRowCode: '380',
        nsbuCodes: ['5900', '5910', '5920'],
        nsbuDescription: 'Other Current Assets / Прочие текущие активы',
        ifrsClassification: 'Other Current Assets',
        section: 'ASSETS - CURRENT',
        subsection: 'Other',
        accountDetails: {
            '5910': 'Inventory Shortages & Losses',
            '5920': 'Other Current Assets'
        }
    },

    // ============================================
    // EQUITY
    // ============================================
    '410': {
        nsbuRowCode: '410',
        nsbuCodes: ['8300', '8310', '8320', '8330'],
        nsbuDescription: 'Charter Capital / Уставный капитал',
        ifrsClassification: 'Share Capital',
        section: 'EQUITY',
        subsection: 'Capital',
        accountDetails: {
            '8310': 'Common Stock',
            '8320': 'Preferred Stock',
            '8330': 'Partnership Capital'
        }
    },
    '420': {
        nsbuRowCode: '420',
        nsbuCodes: ['8400', '8410', '8420'],
        nsbuDescription: 'Additional Capital / Добавленный капитал',
        ifrsClassification: 'Additional Paid-in Capital',
        section: 'EQUITY',
        subsection: 'Capital',
        accountDetails: {
            '8410': 'Share Premium',
            '8420': 'FX Differences on Capital Formation'
        }
    },
    '430': {
        nsbuRowCode: '430',
        nsbuCodes: ['8500', '8510', '8520', '8530'],
        nsbuDescription: 'Reserve Capital / Резервный капитал',
        ifrsClassification: 'Reserves',
        section: 'EQUITY',
        subsection: 'Reserves',
        accountDetails: {
            '8510': 'Revaluation Reserve',
            '8520': 'Legal Reserve',
            '8530': 'Donated Assets'
        }
    },
    '440': {
        nsbuRowCode: '440',
        nsbuCodes: ['8600', '8610', '8620'],
        nsbuDescription: 'Treasury Shares / Выкупленные собственные акции',
        ifrsClassification: 'Treasury Stock',
        section: 'EQUITY',
        subsection: 'Capital',
        isNegative: true,
        accountDetails: {
            '8610': 'Treasury Stock - Common',
            '8620': 'Treasury Stock - Preferred'
        }
    },
    '450': {
        nsbuRowCode: '450',
        nsbuCodes: ['8700', '8710', '8720'],
        nsbuDescription: 'Retained Earnings / Нераспределенная прибыль (непокрытый убыток)',
        ifrsClassification: 'Retained Earnings',
        section: 'EQUITY',
        subsection: 'Retained Earnings',
        accountDetails: {
            '8710': 'Retained Earnings - Current Year',
            '8720': 'Accumulated Retained Earnings'
        }
    },
    '460': {
        nsbuRowCode: '460',
        nsbuCodes: ['8800', '8810', '8820', '8830', '8840', '8890'],
        nsbuDescription: 'Targeted Funds / Целевые поступления',
        ifrsClassification: 'Grants & Restricted Funds',
        section: 'EQUITY',
        subsection: 'Reserves',
        accountDetails: {
            '8810': 'Grants',
            '8820': 'Government Subsidies',
            '8830': 'Membership Contributions',
            '8840': 'Tax Benefits - Restricted Use',
            '8890': 'Other Restricted Contributions'
        }
    },
    '470': {
        nsbuRowCode: '470',
        nsbuCodes: ['8900', '8910'],
        nsbuDescription: 'Provisions / Резервы предстоящих расходов и платежей',
        ifrsClassification: 'Provisions for Liabilities',
        section: 'EQUITY',
        subsection: 'Reserves',
        accountDetails: {
            '8910': 'Provisions'
        }
    },

    // ============================================
    // LIABILITIES - NON-CURRENT
    // ============================================
    
    // LONG-TERM PAYABLES
    '500': {
        nsbuRowCode: '500',
        nsbuCodes: ['7000', '7010', '7020'],
        nsbuDescription: 'LT Suppliers Payable / Долгосрочная задолженность поставщикам',
        ifrsClassification: 'Long-term Trade Payables',
        section: 'LIABILITIES - NON-CURRENT',
        subsection: 'Long-term Payables',
        accountDetails: {
            '7010': 'LT Accounts Payable',
            '7020': 'Long-term Notes Payable'
        }
    },
    '510': {
        nsbuRowCode: '510',
        nsbuCodes: ['7110'],
        nsbuDescription: 'LT Separated Units Due / Долгосрочная задолженность обособленным подразделениям',
        ifrsClassification: 'LT Payables to Branches',
        section: 'LIABILITIES - NON-CURRENT',
        subsection: 'Long-term Payables'
    },
    '520': {
        nsbuRowCode: '520',
        nsbuCodes: ['7120'],
        nsbuDescription: 'LT Subsidiary Due / Долгосрочная задолженность дочерним обществам',
        ifrsClassification: 'LT Payables to Subsidiaries',
        section: 'LIABILITIES - NON-CURRENT',
        subsection: 'Long-term Payables'
    },
    
    // LONG-TERM DEFERRED ITEMS
    '530': {
        nsbuRowCode: '530',
        nsbuCodes: ['7210', '7220', '7230'],
        nsbuDescription: 'LT Deferred Income / Долгосрочные отсроченные доходы',
        ifrsClassification: 'LT Deferred Revenue',
        section: 'LIABILITIES - NON-CURRENT',
        subsection: 'Deferred Items',
        accountDetails: {
            '7210': 'LT Deferred Revenue - Discounts',
            '7220': 'LT Deferred Revenue - Premiums',
            '7230': 'Other LT Deferred Revenue'
        }
    },
    '540': {
        nsbuRowCode: '540',
        nsbuCodes: ['7240'],
        nsbuDescription: 'LT Deferred Tax Liabilities / Долгосрочные отсроченные налоговые обязательства',
        ifrsClassification: 'LT Deferred Tax Liabilities',
        section: 'LIABILITIES - NON-CURRENT',
        subsection: 'Deferred Items'
    },
    '550': {
        nsbuRowCode: '550',
        nsbuCodes: ['7250', '7290'],
        nsbuDescription: 'LT Other Deferred Liabilities / Прочие долгосрочные отсроченные обязательства',
        ifrsClassification: 'LT Other Deferred Liabilities',
        section: 'LIABILITIES - NON-CURRENT',
        subsection: 'Deferred Items',
        accountDetails: {
            '7250': 'Deferred Tax Liabilities - LT',
            '7290': 'Other LT Deferred Liabilities'
        }
    },
    '560': {
        nsbuRowCode: '560',
        nsbuCodes: ['7300', '7310'],
        nsbuDescription: 'LT Customer Advances / Авансы от покупателей (долгосрочные)',
        ifrsClassification: 'Customer Advances - Non-Current',
        section: 'LIABILITIES - NON-CURRENT',
        subsection: 'Long-term Payables',
        accountDetails: {
            '7310': 'Customer Prepayments - LT'
        }
    },
    
    // LONG-TERM BORROWINGS
    '570': {
        nsbuRowCode: '570',
        nsbuCodes: ['7810'],
        nsbuDescription: 'LT Bank Credits / Долгосрочные банковские кредиты',
        ifrsClassification: 'Long-term Bank Loans',
        section: 'LIABILITIES - NON-CURRENT',
        subsection: 'Borrowings'
    },
    '580': {
        nsbuRowCode: '580',
        nsbuCodes: ['7820', '7830', '7840'],
        nsbuDescription: 'LT Other Borrowings / Долгосрочные займы и прочие заимствования',
        ifrsClassification: 'LT Other Loans & Borrowings',
        section: 'LIABILITIES - NON-CURRENT',
        subsection: 'Borrowings',
        accountDetails: {
            '7820': 'Long-term Loans',
            '7830': 'Bonds Payable - Non-Current',
            '7840': 'Long-term Bills Payable'
        }
    },
    '590': {
        nsbuRowCode: '590',
        nsbuCodes: ['7900', '7910', '7920'],
        nsbuDescription: 'LT Other Liabilities / Прочие долгосрочные обязательства',
        ifrsClassification: 'Other Non-Current Liabilities',
        section: 'LIABILITIES - NON-CURRENT',
        subsection: 'Other',
        accountDetails: {
            '7910': 'Finance Lease Liabilities',
            '7920': 'Other LT Payables'
        }
    },

    // ============================================
    // LIABILITIES - CURRENT
    // ============================================
    
    // TRADE PAYABLES
    '610': {
        nsbuRowCode: '610',
        nsbuCodes: ['6000', '6010', '6020'],
        nsbuDescription: 'ST Suppliers Payable / Задолженность поставщикам и подрядчикам',
        ifrsClassification: 'Trade Payables - Suppliers',
        section: 'LIABILITIES - CURRENT',
        subsection: 'Trade Payables',
        accountDetails: {
            '6010': 'Accounts Payable - Trade',
            '6020': 'Notes Payable'
        }
    },
    '620': {
        nsbuRowCode: '620',
        nsbuCodes: ['6110'],
        nsbuDescription: 'ST Separated Units Due / Задолженность обособленным подразделениям',
        ifrsClassification: 'Payables to Branches',
        section: 'LIABILITIES - CURRENT',
        subsection: 'Trade Payables'
    },
    '630': {
        nsbuRowCode: '630',
        nsbuCodes: ['6120'],
        nsbuDescription: 'ST Subsidiary Due / Задолженность дочерним обществам',
        ifrsClassification: 'Payables to Subsidiaries',
        section: 'LIABILITIES - CURRENT',
        subsection: 'Trade Payables'
    },
    
    // DEFERRED ITEMS
    '640': {
        nsbuRowCode: '640',
        nsbuCodes: ['6210', '6220', '6230'],
        nsbuDescription: 'ST Deferred Income / Отсроченные доходы',
        ifrsClassification: 'Deferred Revenue - Current',
        section: 'LIABILITIES - CURRENT',
        subsection: 'Deferred Items',
        accountDetails: {
            '6210': 'Deferred Revenue - Discounts',
            '6220': 'Deferred Revenue - Premiums',
            '6230': 'Other Deferred Revenue'
        }
    },
    '650': {
        nsbuRowCode: '650',
        nsbuCodes: ['6240'],
        nsbuDescription: 'ST Deferred Tax Obligations / Отсроченные налоговые обязательства',
        ifrsClassification: 'Deferred Tax Liabilities - Current',
        section: 'LIABILITIES - CURRENT',
        subsection: 'Deferred Items'
    },
    '660': {
        nsbuRowCode: '660',
        nsbuCodes: ['6250', '6290'],
        nsbuDescription: 'ST Other Deferred Liabilities / Прочие отсроченные обязательства',
        ifrsClassification: 'Other Deferred Liabilities - Current',
        section: 'LIABILITIES - CURRENT',
        subsection: 'Deferred Items',
        accountDetails: {
            '6250': 'Deferred Tax Liabilities - Income Tax',
            '6290': 'Other Deferred Liabilities'
        }
    },
    '670': {
        nsbuRowCode: '670',
        nsbuCodes: ['6300', '6310', '6320', '6390'],
        nsbuDescription: 'ST Customer Advances / Полученные авансы от покупателей',
        ifrsClassification: 'Advances from Customers - Current',
        section: 'LIABILITIES - CURRENT',
        subsection: 'Trade Payables',
        accountDetails: {
            '6310': 'Customer Advances - Current',
            '6320': 'Share Subscription Deposits',
            '6390': 'Other Advances Received'
        }
    },
    
    // OTHER CURRENT PAYABLES
    '680': {
        nsbuRowCode: '680',
        nsbuCodes: ['6400', '6410'],
        nsbuDescription: 'ST Tax Payables / Задолженность по платежам в бюджет',
        ifrsClassification: 'Taxes Payable',
        section: 'LIABILITIES - CURRENT',
        subsection: 'Other Payables',
        accountDetails: {
            '6410': 'Taxes & Levies Payable (by type)'
        }
    },
    '690': {
        nsbuRowCode: '690',
        nsbuCodes: ['6510'],
        nsbuDescription: 'ST Insurance Payables / Задолженность по страхованию',
        ifrsClassification: 'Insurance Premiums Payable',
        section: 'LIABILITIES - CURRENT',
        subsection: 'Other Payables'
    },
    '700': {
        nsbuRowCode: '700',
        nsbuCodes: ['6520'],
        nsbuDescription: 'ST Social Fund Payables / Задолженность в государственные целевые фонды',
        ifrsClassification: 'State Fund Contributions Payable',
        section: 'LIABILITIES - CURRENT',
        subsection: 'Other Payables'
    },
    '710': {
        nsbuRowCode: '710',
        nsbuCodes: ['6600', '6610', '6620', '6630'],
        nsbuDescription: 'ST Shareholder Payables / Задолженность учредителям',
        ifrsClassification: 'Payables to Shareholders',
        section: 'LIABILITIES - CURRENT',
        subsection: 'Other Payables',
        accountDetails: {
            '6610': 'Dividends Payable',
            '6620': 'Payables to Withdrawing Shareholders',
            '6630': 'Shareholder Capital Contributions'
        }
    },
    '720': {
        nsbuRowCode: '720',
        nsbuCodes: ['6700', '6710', '6720'],
        nsbuDescription: 'ST Employee Payables / Задолженность по оплате труда',
        ifrsClassification: 'Payroll Payables',
        section: 'LIABILITIES - CURRENT',
        subsection: 'Other Payables',
        accountDetails: {
            '6710': 'Wages & Salaries Payable',
            '6720': 'Unclaimed Wages'
        }
    },
    
    // SHORT-TERM BORROWINGS
    '730': {
        nsbuRowCode: '730',
        nsbuCodes: ['6810'],
        nsbuDescription: 'ST Bank Credits / Краткосрочные банковские кредиты',
        ifrsClassification: 'Short-term Bank Loans',
        section: 'LIABILITIES - CURRENT',
        subsection: 'Borrowings'
    },
    '740': {
        nsbuRowCode: '740',
        nsbuCodes: ['6820', '6830', '6840'],
        nsbuDescription: 'ST Other Loans / Краткосрочные займы и прочие заимствования',
        ifrsClassification: 'Short-term Borrowings',
        section: 'LIABILITIES - CURRENT',
        subsection: 'Borrowings',
        accountDetails: {
            '6820': 'Short-term Loans',
            '6830': 'Bonds Payable - Current',
            '6840': 'Bills Payable'
        }
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
        nsbuCodes: ['6900', '6910', '6920', '6930', '6940', '6960', '6970', '6990'],
        nsbuDescription: 'ST Other Liabilities / Прочие текущие обязательства',
        ifrsClassification: 'Other Current Liabilities',
        section: 'LIABILITIES - CURRENT',
        subsection: 'Other Payables',
        excludedAccounts: ['6950'],  // Already mapped to row 750
        accountDetails: {
            '6910': 'Operating Lease Payables',
            '6920': 'Accrued Interest',
            '6930': 'Royalties Payable',
            '6940': 'Warranty Provision',
            '6960': 'Claims Payable',
            '6970': 'Payables to Accountable Persons',
            '6990': 'Other Payables'
        }
    }
};

// Section totals - for reference and validation
const SECTION_TOTALS = {
    '130': 'Total Non-current Assets',
    '390': 'Total Current Assets',
    '400': 'TOTAL ASSETS',
    '480': 'Total Equity',
    '490': 'Total Non-current Liabilities',
    '600': 'Total Current Liabilities',
    '770': 'Total Liabilities',
    '780': 'TOTAL EQUITY AND LIABILITIES'
};

/**
 * Get IFRS classification for a given NSBU row code
 * @param {string} rowCode - The NSBU row code (e.g., '010', '220')
 * @returns {Object|null} - The mapping object or null if not found
 */
function getIFRSMapping(rowCode) {
    const code = String(rowCode).padStart(3, '0').trim();
    return BALANCE_SHEET_MAPPING[code] || null;
}

/**
 * Get all mappings for a specific section
 * @param {string} section - The section name
 * @returns {Array} - Array of mapping objects
 */
function getMappingsBySection(section) {
    return Object.values(BALANCE_SHEET_MAPPING).filter(
        mapping => mapping.section === section
    );
}

/**
 * Get subsection structure for organizing the IFRS balance sheet
 * @returns {Object} - Structured object with sections and subsections
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
        if (!structure[mapping.section]) {
            structure[mapping.section] = {};
        }
        if (!structure[mapping.section][mapping.subsection]) {
            structure[mapping.section][mapping.subsection] = [];
        }
        structure[mapping.section][mapping.subsection].push(mapping);
    });

    return structure;
}

/**
 * Check if an account code should be included for a given row
 * @param {string} rowCode - The NSBU row code
 * @param {string} accountCode - The account code to check
 * @returns {boolean} - True if account should be included
 */
function isAccountIncluded(rowCode, accountCode) {
    const mapping = getIFRSMapping(rowCode);
    if (!mapping) return false;
    
    // Check excluded accounts
    if (mapping.excludedAccounts && mapping.excludedAccounts.includes(accountCode)) {
        return false;
    }
    
    // Check if account is in the nsbuCodes array
    return mapping.nsbuCodes.includes(accountCode);
}

module.exports = {
    BALANCE_SHEET_MAPPING,
    SECTION_TOTALS,
    getIFRSMapping,
    getMappingsBySection,
    getIFRSStructure,
    isAccountIncluded
};