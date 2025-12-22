const ExcelJS = require('exceljs');

function detectBalanceSheetStructure(worksheet) {
    let headerRow = null;
    let codeColumn = null;
    let nameColumn = null;
    let dataStartRow = null;
    
    function getCellText(cell) {
        if (!cell || !cell.value) return '';
        if (typeof cell.value === 'object' && cell.value.richText) {
            return cell.value.richText.map(t => t.text || '').join(' ');
        }
        return String(cell.value);
    }
    
    function normalizeText(text) {
        if (!text) return '';
        return String(text).replace(/\s+/g, ' ').trim().toLowerCase();
    }
    
    let lastMeaningfulRow = worksheet.rowCount;
    
    for (let rowNum = 1; rowNum <= worksheet.rowCount; rowNum++) {
        const row = worksheet.getRow(rowNum);
        
        row.eachCell((cell) => {
            const cellText = getCellText(cell);
            const normalized = normalizeText(cellText);
            
            if (normalized.includes('раҳбар') || normalized.includes('руководитель') || 
                normalized.includes('бош бухгалтер') || normalized.includes('главный бухгалтер')) {
                lastMeaningfulRow = rowNum;
                global.logger.logInfo(`Found end marker at row ${rowNum}`);
            }
        });
        
        if (rowNum > lastMeaningfulRow + 5) break;
    }
    
    global.logger.logInfo(`Searching for structure in ${lastMeaningfulRow} meaningful rows`);
    
    for (let rowNum = 1; rowNum <= lastMeaningfulRow; rowNum++) {
        const row = worksheet.getRow(rowNum);
        
        row.eachCell((cell, colNumber) => {
            const cellText = getCellText(cell);
            const normalized = normalizeText(cellText);
            
            if (normalized.includes('код стр') || normalized.includes('сатр коди')) {
                codeColumn = colNumber;
                headerRow = rowNum;
                global.logger.logInfo(`✓ Found code column at row ${rowNum}, col ${colNumber}`);
            }
        });
        
        if (codeColumn) break;
    }
    
    if (!codeColumn) {
        throw new Error('Could not find code column (Код стр / Сатр коди)');
    }
    
    for (let rowNum = headerRow; rowNum <= Math.min(headerRow + 20, lastMeaningfulRow); rowNum++) {
        const row = worksheet.getRow(rowNum);
        
        row.eachCell((cell, colNumber) => {
            const cellText = getCellText(cell);
            const normalized = normalizeText(cellText);
            
            if (normalized === 'актив' || normalized === 'aktiv') {
                dataStartRow = rowNum + 1;
                nameColumn = colNumber;
                global.logger.logInfo(`✓ Found "Актив" at row ${rowNum}, col ${colNumber}`);
            }
        });
        
        if (dataStartRow) break;
    }
    
    if (!dataStartRow || !nameColumn) {
        throw new Error('Could not find Assets section (Актив)');
    }
    
    const headerRowData = worksheet.getRow(headerRow);
    const valueColumns = [];
    
    headerRowData.eachCell((cell, colNumber) => {
        const cellText = getCellText(cell);
        const normalized = normalizeText(cellText);
        
        if (normalized.includes('начало') || normalized.includes('бошига')) {
            valueColumns.push({ type: 'start', column: colNumber });
            global.logger.logInfo(`✓ Found start period column: ${colNumber}`);
        }
        
        if (normalized.includes('конец') || normalized.includes('охирига') || normalized.includes('охир')) {
            valueColumns.push({ type: 'end', column: colNumber });
            global.logger.logInfo(`✓ Found end period column: ${colNumber}`);
        }
    });
    
    if (valueColumns.length === 0) {
        throw new Error('Could not find value columns');
    }
    
    return {
        headerRow,
        dataStartRow,
        codeColumn,
        nameColumn,
        valueColumns,
        lastMeaningfulRow
    };
}

function extractBalanceSheetData(worksheet, structure) {
    const { dataStartRow, codeColumn, nameColumn, valueColumns } = structure;
    const dataMap = new Map();
    
    for (let rowNum = dataStartRow; rowNum <= worksheet.rowCount; rowNum++) {
        const row = worksheet.getRow(rowNum);
        
        const codeCell = row.getCell(codeColumn);
        const code = codeCell.value?.toString().trim();
        
        if (!code || code === '' || isNaN(parseInt(code))) {
            continue;
        }
        
        const nameCell = row.getCell(nameColumn);
        const name = nameCell.value?.toString().trim() || '';
        
        const values = {};
        valueColumns.forEach(({ type, column }) => {
            const valueCell = row.getCell(column);
            let value = valueCell.value;
            
            if (typeof value === 'string') {
                value = value.replace(/,/g, '').replace(/\s/g, '');
                if (value === '-' || value === '') {
                    value = 0;
                } else {
                    value = parseFloat(value) || 0;
                }
            } else if (typeof value === 'number') {
                value = value;
            } else {
                value = 0;
            }
            
            values[type] = value;
        });
        
        dataMap.set(code, {
            code,
            name,
            ...values
        });
    }
    
    return dataMap;
}

async function transformToIFRS(dataMap) {
    const mapping = {
        // Assets - Non-current
        '010': { ifrs: 'PPE_Gross', label: 'PP&E - Gross Book Value' },
        '011': { ifrs: 'PPE_Depreciation', label: 'Accumulated Depreciation' },
        '012': { ifrs: 'PPE_Net', label: 'PP&E - Net Book Value' },
        '020': { ifrs: 'Intangible_Gross', label: 'Intangible Assets - Gross' },
        '021': { ifrs: 'Intangible_Amortization', label: 'Accumulated Amortization' },
        '022': { ifrs: 'Intangible_Net', label: 'Intangible Assets - Net' },
        '090': { ifrs: 'Equipment_Install', label: 'Equipment to be Installed' },
        '130': { ifrs: 'Total_NonCurrent', label: 'Total Non-Current Assets' },
        
        // Assets - Current
        '140': { ifrs: 'Inventory_Total', label: 'Total Inventories' },
        '150': { ifrs: 'Inventory_Materials', label: 'Raw Materials & Supplies' },
        '160': { ifrs: 'Inventory_WIP', label: 'Work in Progress' },
        '170': { ifrs: 'Inventory_Finished', label: 'Finished Goods' },
        '180': { ifrs: 'Inventory_Goods', label: 'Goods for Resale' },
        '210': { ifrs: 'Receivables_Total', label: 'Total Trade Receivables' },
        '220': { ifrs: 'Receivables_Customers', label: 'Trade Receivables - Customers' },
        '320': { ifrs: 'Cash_Total', label: 'Cash and Cash Equivalents' },
        '370': { ifrs: 'Investments_ST', label: 'Short-term Investments' },
        '390': { ifrs: 'Total_Current', label: 'Total Current Assets' },
        '400': { ifrs: 'Total_Assets', label: 'TOTAL ASSETS' },
        
        // Equity
        '410': { ifrs: 'Equity_Share', label: 'Share Capital' },
        '420': { ifrs: 'Equity_Premium', label: 'Share Premium/Additional Capital' },
        '430': { ifrs: 'Equity_Reserve', label: 'Reserve Capital' },
        '440': { ifrs: 'Equity_Treasury', label: 'Treasury Shares' },
        '450': { ifrs: 'Equity_Retained', label: 'Retained Earnings/(Losses)' },
        '480': { ifrs: 'Total_Equity', label: 'Total Equity' },
        
        // Liabilities - Non-current
        '570': { ifrs: 'LT_BankLoans', label: 'LT Bank Credits/Loans' },
        '580': { ifrs: 'LT_Borrowings', label: 'LT Other Loans & Borrowings' },
        '590': { ifrs: 'LT_Other', label: 'LT Other Liabilities' },
        '490': { ifrs: 'Total_LT_Liabilities', label: 'Total Non-Current Liabilities' },
        
        // Liabilities - Current
        '610': { ifrs: 'ST_Payables', label: 'ST Supplier Payables' },
        '670': { ifrs: 'ST_Advances', label: 'ST Advances from Customers' },
        '680': { ifrs: 'ST_Tax', label: 'ST Tax & Duty Payables' },
        '720': { ifrs: 'ST_Salaries', label: 'ST Payables to Employees' },
        '740': { ifrs: 'ST_Borrowings', label: 'ST Bank Credits/Loans' },
        '600': { ifrs: 'Total_ST_Liabilities', label: 'Total Current Liabilities' },
        '770': { ifrs: 'Total_Liabilities', label: 'Total Liabilities' },
        '780': { ifrs: 'Total_Equity_Liabilities', label: 'TOTAL EQUITY AND LIABILITIES' }
    };
    
    const ifrsData = {};
    
    dataMap.forEach((item, code) => {
        if (mapping[code]) {
            ifrsData[code] = {
                code,
                label: mapping[code].label,
                start: item.start || 0,
                end: item.end || 0
            };
        }
    });
    
    return ifrsData;
}

async function processBalanceSheetTemplate(workbook) {
    const result = {
        workbook: new ExcelJS.Workbook(),
        summary: {
            transformations: 0,
            changes: 0,
            originalRows: 0,
            processedRows: 0,
            worksheets: [],
            warnings: []
        }
    };

    try {
        const worksheet = workbook.worksheets[0];
        
        // Detect structure
        const structure = detectBalanceSheetStructure(worksheet);
        global.logger.logInfo(`Detected structure: ${JSON.stringify(structure)}`);
        
        // Extract data
        const dataMap = extractBalanceSheetData(worksheet, structure);
        global.logger.logInfo(`Extracted ${dataMap.size} line items`);
        
        // Transform to IFRS
        const ifrsData = await transformToIFRS(dataMap);
        
        // Create IFRS sheet
        const outputSheet = result.workbook.addWorksheet('IFRS Balance Sheet');
        
        outputSheet.addRow(['BALANCE SHEET - IFRS PRESENTATION']);
        outputSheet.addRow(['As of Period End']);
        outputSheet.addRow([]);
        outputSheet.addRow(['Account', 'Start Period', 'End Period']);
        
        Object.entries(ifrsData).forEach(([key, data]) => {
            outputSheet.addRow([data.label, data.start, data.end]);
        });
        
        // Set column widths
        outputSheet.getColumn(1).width = 45;
        outputSheet.getColumn(2).width = 18;
        outputSheet.getColumn(3).width = 18;
        
        result.summary.transformations = dataMap.size;
        result.summary.changes = Object.keys(ifrsData).length;
        result.summary.originalRows = dataMap.size;
        result.summary.processedRows = Object.keys(ifrsData).length;
        
        global.logger.logInfo(`Balance sheet processing completed: ${result.summary.changes} transformations`);
        
        return result;

    } catch (error) {
        global.logger.logError(`Balance sheet processing error: ${error.message}`);
        throw new Error(`Failed to process balance sheet: ${error.message}`);
    }
}

module.exports = {
    processBalanceSheetTemplate
};