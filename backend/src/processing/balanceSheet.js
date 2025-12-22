const ExcelJS = require('exceljs');
const {
    BALANCE_SHEET_MAPPING,
    SECTION_TOTALS,
    getIFRSMapping,
    getIFRSStructure
} = require('../mappings/balanceSheetMapping');

/**
 * Process balance sheet template - transform NSBU to IFRS format
 * Handles Uzbek Balance Sheet (Form № 1 - ОКУД 0710001) transformation
 */
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
        // Copy workbook structure
        result.workbook = new ExcelJS.Workbook();

        // Copy each worksheet from source to target
        workbook.eachSheet((sourceWorksheet, sheetId) => {
            const targetWorksheet = result.workbook.addWorksheet(sourceWorksheet.name);

            // Copy all rows and cells
            sourceWorksheet.eachRow((row, rowNumber) => {
                const targetRow = targetWorksheet.getRow(rowNumber);
                row.eachCell((cell, colNumber) => {
                    targetRow.getCell(colNumber).value = cell.value;
                    targetRow.getCell(colNumber).style = cell.style;
                });
            });

            // Copy column properties
            sourceWorksheet.columns.forEach((column, index) => {
                if (column.width) {
                    targetWorksheet.getColumn(index + 1).width = column.width;
                }
            });
        });

        let totalTransformations = 0;
        let totalChanges = 0;
        let totalOriginalRows = 0;
        let totalProcessedRows = 0;

        // Process first worksheet (balance sheet is typically in first sheet)
        const firstWorksheet = workbook.getWorksheet(1);
        if (firstWorksheet) {
            const worksheetResult = processBalanceSheetWorksheet(
                firstWorksheet,
                result.workbook.getWorksheet(1)
            );

            result.summary.worksheets.push({
                name: firstWorksheet.name,
                originalRows: worksheetResult.originalRows,
                processedRows: worksheetResult.processedRows,
                changes: worksheetResult.changes
            });

            totalTransformations += worksheetResult.transformations;
            totalChanges += worksheetResult.changes;
            totalOriginalRows += worksheetResult.originalRows;
            totalProcessedRows += worksheetResult.processedRows;

            result.summary.warnings.push(...worksheetResult.warnings);
        }

        result.summary.transformations = totalTransformations;
        result.summary.changes = totalChanges;
        result.summary.originalRows = totalOriginalRows;
        result.summary.processedRows = totalProcessedRows;

        // Add IFRS-formatted balance sheet
        addIFRSBalanceSheet(result.workbook, firstWorksheet, result.summary);

        // Add compliance notes
        addIFRSComplianceSheet(result.workbook, result.summary);

        result.summary.summary = `Processed balance sheet with ${totalChanges} IFRS transformations applied to ${totalOriginalRows} line items.`;

        global.logger.logInfo(`Balance sheet processing completed: ${totalChanges} changes applied to ${totalOriginalRows} rows`);

        return result;

    } catch (error) {
        global.logger.logError('Balance sheet processing error:', error);
        throw new Error(`Failed to process balance sheet: ${error.message}`);
    }
}

/**
 * Process individual worksheet - add IFRS classifications
 */
function processBalanceSheetWorksheet(sourceWorksheet, targetWorksheet) {
    const result = {
        transformations: 0,
        changes: 0,
        originalRows: 0,
        processedRows: 0,
        warnings: []
    };

    try {
        // Detect structure
        const structure = detectBalanceSheetStructure(sourceWorksheet);

        if (!structure.dataStartRow) {
            result.warnings.push({
                message: 'Could not detect balance sheet data structure',
                severity: 'error'
            });
            return result;
        }

        // Add IFRS classification column header
        const headerRow = targetWorksheet.getRow(structure.headerRow);
        const ifrsColumnIndex = structure.amountColumn + 2; // Place after last amount column

        headerRow.getCell(ifrsColumnIndex).value = 'IFRS Classification';
        headerRow.getCell(ifrsColumnIndex).font = { bold: true };
        headerRow.getCell(ifrsColumnIndex).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF9500FF' }  // ATABAI violet
        };
        headerRow.getCell(ifrsColumnIndex).font.color = { argb: 'FFFFFFFF' };
        result.transformations++;

        // Process data rows
        let currentRow = structure.dataStartRow;

        while (currentRow <= sourceWorksheet.rowCount) {
            const row = sourceWorksheet.getRow(currentRow);
            const targetRow = targetWorksheet.getRow(currentRow);

            // Get row code from column 2
            const rowCode = getCellValue(row.getCell(structure.codeColumn));

            if (rowCode) {
                result.originalRows++;

                // Get IFRS mapping
                const mapping = getIFRSMapping(rowCode);

                if (mapping) {
                    // Add IFRS classification
                    targetRow.getCell(ifrsColumnIndex).value = mapping.ifrsClassification;
                    targetRow.getCell(ifrsColumnIndex).fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFF3E8FF' }  // Light purple
                    };

                    result.changes++;
                    result.processedRows++;
                } else if (!SECTION_TOTALS[rowCode]) {
                    // Only warn for non-total rows
                    result.warnings.push({
                        message: `Row ${currentRow}: No IFRS mapping found for code ${rowCode}`,
                        row: currentRow,
                        severity: 'warning'
                    });
                }
            }

            currentRow++;
        }

        // Set column width for IFRS classification
        targetWorksheet.getColumn(ifrsColumnIndex).width = 35;

    } catch (error) {
        result.warnings.push({
            message: `Error processing worksheet: ${error.message}`,
            severity: 'error'
        });
    }

    return result;
}

/**
 * Detect the structure of the balance sheet
 */
function detectBalanceSheetStructure(worksheet) {
    let headerRow = null;
    let codeColumn = null;
    let nameColumn = null;
    let dataStartRow = null;
    
    // Step 1: Find header row with "Код стр" (code column indicator)
    for (let rowNum = 1; rowNum <= Math.min(50, worksheet.rowCount); rowNum++) {
        const row = worksheet.getRow(rowNum);
        
        row.eachCell((cell, colNumber) => {
            const cellValue = cell.value?.toString().toLowerCase() || '';
            
            // Look for "код стр" or "сатр коди" (Uzbek/Russian for "line code")
            if (cellValue.includes('код стр') || cellValue.includes('сатр коди')) {
                codeColumn = colNumber;
                headerRow = rowNum;
                global.logger.logInfo(`Found code column at row ${rowNum}, col ${colNumber}`);
            }
        });
        
        if (codeColumn) break;
    }
    
    if (!codeColumn) {
        throw new Error('Could not find code column (Код стр)');
    }
    
    // Step 2: Find "Актив" row (Assets section start)
    for (let rowNum = headerRow; rowNum <= Math.min(headerRow + 10, worksheet.rowCount); rowNum++) {
        const row = worksheet.getRow(rowNum);
        
        row.eachCell((cell, colNumber) => {
            const cellValue = cell.value?.toString().trim().toLowerCase() || '';
            
            if (cellValue === 'актив' || cellValue === 'aktiv') {
                dataStartRow = rowNum + 1; // Data starts AFTER "Актив"
                nameColumn = colNumber; // This column has the names
                global.logger.logInfo(`Found "Актив" at row ${rowNum}, col ${colNumber}`);
            }
        });
        
        if (dataStartRow) break;
    }
    
    if (!dataStartRow || !nameColumn) {
        throw new Error('Could not find Assets section (Актив)');
    }
    
    // Step 3: Find value columns by looking at header row
    const headerRowData = worksheet.getRow(headerRow);
    const valueColumns = [];
    
    headerRowData.eachCell((cell, colNumber) => {
        const cellValue = cell.value?.toString().toLowerCase() || '';
        
        // Look for period indicators
        if (cellValue.includes('начало') || cellValue.includes('boshiga')) {
            valueColumns.push({ type: 'start', column: colNumber });
            global.logger.logInfo(`Found start period column: ${colNumber}`);
        }
        
        if (cellValue.includes('конец') || cellValue.includes('охирига')) {
            valueColumns.push({ type: 'end', column: colNumber });
            global.logger.logInfo(`Found end period column: ${colNumber}`);
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
        valueColumns
    };
}

function extractBalanceSheetData(worksheet, structure) {
    const { dataStartRow, codeColumn, nameColumn, valueColumns } = structure;
    const dataMap = new Map();
    
    // Read all rows and build code -> values map
    for (let rowNum = dataStartRow; rowNum <= worksheet.rowCount; rowNum++) {
        const row = worksheet.getRow(rowNum);
        
        // Get code
        const codeCell = row.getCell(codeColumn);
        const code = codeCell.value?.toString().trim();
        
        if (!code || code === '' || isNaN(parseInt(code))) {
            continue; // Skip rows without valid codes
        }
        
        // Get name
        const nameCell = row.getCell(nameColumn);
        const name = nameCell.value?.toString().trim() || '';
        
        // Get values for each period
        const values = {};
        valueColumns.forEach(({ type, column }) => {
            const valueCell = row.getCell(column);
            let value = valueCell.value;
            
            // Handle different value formats
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
        
        global.logger.logInfo(`Extracted code ${code}: ${name} = ${JSON.stringify(values)}`);
    }
    
    return dataMap;
}

async function transformToIFRS(dataMap) {
    // NSBU -> IFRS mapping
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
    
    // Build IFRS structure
    const ifrsData = {};
    
    dataMap.forEach((item, code) => {
        if (mapping[code]) {
            const { ifrs, label } = mapping[code];
            ifrsData[ifrs] = {
                code,
                label,
                start: item.start || 0,
                end: item.end || 0
            };
        }
    });
    
    return ifrsData;
}

async function processBalanceSheetTemplate(workbook, filePath) {
    try {
        const worksheet = workbook.worksheets[0];
        
        // Step 1: Detect structure dynamically
        const structure = detectBalanceSheetStructure(worksheet);
        global.logger.logInfo(`Detected structure: ${JSON.stringify(structure)}`);
        
        // Step 2: Extract all data by code
        const dataMap = extractBalanceSheetData(worksheet, structure);
        global.logger.logInfo(`Extracted ${dataMap.size} line items`);
        
        // Step 3: Transform to IFRS
        const ifrsData = await transformToIFRS(dataMap);
        
        // Step 4: Create output workbook
        const outputWorkbook = new ExcelJS.Workbook();
        const outputSheet = outputWorkbook.addWorksheet('IFRS Balance Sheet');
        
        // Add IFRS presentation
        outputSheet.addRow(['BALANCE SHEET - IFRS PRESENTATION']);
        outputSheet.addRow(['As of Period End']);
        outputSheet.addRow([]);
        outputSheet.addRow(['ASSETS', 'Start Period', 'End Period']);
        
        // Non-Current Assets
        outputSheet.addRow(['NON-CURRENT ASSETS']);
        if (ifrsData.PPE_Net) {
            outputSheet.addRow(['Property, Plant and Equipment', ifrsData.PPE_Net.start, ifrsData.PPE_Net.end]);
        }
        if (ifrsData.Intangible_Net) {
            outputSheet.addRow(['Intangible Assets', ifrsData.Intangible_Net.start, ifrsData.Intangible_Net.end]);
        }
        if (ifrsData.Total_NonCurrent) {
            outputSheet.addRow(['Total Non-Current Assets', ifrsData.Total_NonCurrent.start, ifrsData.Total_NonCurrent.end]);
        }
        
        outputSheet.addRow([]);
        
        // Current Assets
        outputSheet.addRow(['CURRENT ASSETS']);
        if (ifrsData.Inventory_Total) {
            outputSheet.addRow(['Inventories', ifrsData.Inventory_Total.start, ifrsData.Inventory_Total.end]);
        }
        if (ifrsData.Receivables_Total) {
            outputSheet.addRow(['Trade Receivables', ifrsData.Receivables_Total.start, ifrsData.Receivables_Total.end]);
        }
        if (ifrsData.Cash_Total) {
            outputSheet.addRow(['Cash and Cash Equivalents', ifrsData.Cash_Total.start, ifrsData.Cash_Total.end]);
        }
        if (ifrsData.Total_Current) {
            outputSheet.addRow(['Total Current Assets', ifrsData.Total_Current.start, ifrsData.Total_Current.end]);
        }
        
        if (ifrsData.Total_Assets) {
            outputSheet.addRow([]);
            outputSheet.addRow(['TOTAL ASSETS', ifrsData.Total_Assets.start, ifrsData.Total_Assets.end]);
        }
        
        // Save
        const outputPath = filePath.replace('.xls', '_ifrs.xlsx');
        await outputWorkbook.xlsx.writeFile(outputPath);
        
        return {
            success: true,
            outputPath,
            transformations: dataMap.size,
            changes: Object.keys(ifrsData).length
        };
        
    } catch (error) {
        global.logger.logError(`Balance sheet processing error: ${error.message}`);
        throw new Error(`Failed to process balance sheet: ${error.message}`);
    }
}

/**
 * Create a new IFRS-formatted balance sheet
 */
function addIFRSBalanceSheet(workbook, sourceWorksheet, summary) {
    const ifrsSheet = workbook.addWorksheet('IFRS Balance Sheet');

    // Parse source data
    const balanceSheetData = parseBalanceSheetData(sourceWorksheet);

    // Build IFRS structure
    const ifrsStructure = getIFRSStructure();

    let currentRow = 1;

    // Add title
    const titleRow = ifrsSheet.getRow(currentRow);
    titleRow.getCell(1).value = 'IFRS Balance Sheet';
    titleRow.getCell(1).font = { bold: true, size: 16 };
    currentRow += 2;

    // Add company info (extract from source)
    const companyInfo = extractCompanyInfo(sourceWorksheet);
    if (companyInfo.name) {
        const companyRow = ifrsSheet.getRow(currentRow);
        companyRow.getCell(1).value = `Company: ${companyInfo.name}`;
        currentRow++;
    }
    if (companyInfo.date) {
        const dateRow = ifrsSheet.getRow(currentRow);
        dateRow.getCell(1).value = `Date: ${companyInfo.date}`;
        currentRow++;
    }
    currentRow++;

    // Add headers
    const headerRow = ifrsSheet.getRow(currentRow);
    headerRow.getCell(1).value = 'IFRS Classification';
    headerRow.getCell(2).value = 'Beginning Balance';
    headerRow.getCell(3).value = 'Ending Balance';
    headerRow.getCell(4).value = 'NSBU Reference';

    headerRow.font = { bold: true };
    headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF9500FF' }
    };
    headerRow.font.color = { argb: 'FFFFFFFF' };
    currentRow++;

    // Process each section
    const sections = [
        'ASSETS - NON-CURRENT',
        'ASSETS - CURRENT',
        'EQUITY',
        'LIABILITIES - NON-CURRENT',
        'LIABILITIES - CURRENT'
    ];

    sections.forEach(section => {
        // Section header
        const sectionRow = ifrsSheet.getRow(currentRow);
        sectionRow.getCell(1).value = section;
        sectionRow.font = { bold: true, size: 12 };
        sectionRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE5E7EB' }
        };
        currentRow++;

        // Subsections
        const subsections = ifrsStructure[section];
        Object.keys(subsections).forEach(subsectionName => {
            const items = subsections[subsectionName];

            // Subsection header
            const subsectionRow = ifrsSheet.getRow(currentRow);
            subsectionRow.getCell(1).value = `  ${subsectionName}`;
            subsectionRow.font = { bold: true, italic: true };
            currentRow++;

            // Items
            items.forEach(mapping => {
                const dataRow = balanceSheetData[mapping.nsbuRowCode];
                if (dataRow) {
                    const itemRow = ifrsSheet.getRow(currentRow);
                    itemRow.getCell(1).value = `    ${mapping.ifrsClassification}`;
                    itemRow.getCell(2).value = dataRow.beginningAmount || 0;
                    itemRow.getCell(2).numFmt = '#,##0';
                    itemRow.getCell(3).value = dataRow.endingAmount || 0;
                    itemRow.getCell(3).numFmt = '#,##0';
                    itemRow.getCell(4).value = mapping.nsbuCodes.join(', ');
                    itemRow.getCell(4).font = { size: 9, color: { argb: 'FF6B7280' } };
                    currentRow++;
                }
            });

            currentRow++; // Space after subsection
        });
    });

    // Set column widths
    ifrsSheet.getColumn(1).width = 45;
    ifrsSheet.getColumn(2).width = 18;
    ifrsSheet.getColumn(3).width = 18;
    ifrsSheet.getColumn(4).width = 20;
}

/**
 * Parse balance sheet data from source worksheet
 */
function parseBalanceSheetData(worksheet) {
    const data = {};
    const structure = detectBalanceSheetStructure(worksheet);

    if (!structure.dataStartRow) return data;

    for (let rowNum = structure.dataStartRow; rowNum <= worksheet.rowCount; rowNum++) {
        const row = worksheet.getRow(rowNum);
        const rowCode = getCellValue(row.getCell(structure.codeColumn));

        if (rowCode) {
            const beginningAmount = parseNumericValue(getCellValue(row.getCell(3)));
            const endingAmount = parseNumericValue(getCellValue(row.getCell(4)));

            data[rowCode] = {
                rowCode: rowCode,
                description: getCellValue(row.getCell(1)),
                beginningAmount: beginningAmount,
                endingAmount: endingAmount
            };
        }
    }

    return data;
}

/**
 * Extract company information from balance sheet
 */
function extractCompanyInfo(worksheet) {
    const info = {
        name: null,
        date: null
    };

    // Look for company name (usually contains "организация" or "предприятие")
    for (let rowNum = 1; rowNum <= Math.min(50, worksheet.rowCount); rowNum++) {
        const row = worksheet.getRow(rowNum);
        const cell1 = getCellValue(row.getCell(1));
        const cell2 = getCellValue(row.getCell(2));

        // Company name
        if (!info.name && cell1 && (cell1.includes('организация') || cell1.includes('предприятие'))) {
            // Name is usually in next columns
            for (let col = 3; col <= 6; col++) {
                const nameCell = getCellValue(row.getCell(col));
                if (nameCell && nameCell.length > 3) {
                    info.name = nameCell;
                    break;
                }
            }
        }

        // Date
        if (!info.date && cell1 && cell1.includes('Дата')) {
            // Look for date values in subsequent cells
            for (let col = 2; col <= 8; col++) {
                const dateCell = row.getCell(col).value;
                if (dateCell instanceof Date) {
                    info.date = dateCell.toLocaleDateString();
                    break;
                } else {
                    const cellVal = getCellValue(row.getCell(col));
                    if (cellVal && /\d{4}/.test(cellVal)) {
                        info.date = cellVal;
                        break;
                    }
                }
            }
        }

        if (info.name && info.date) break;
    }

    return info;
}

/**
 * Add IFRS compliance notes sheet
 */
function addIFRSComplianceSheet(workbook, summary) {
    const complianceSheet = workbook.addWorksheet('IFRS Compliance Notes');

    // Add headers
    complianceSheet.getCell('A1').value = 'ATABAI - IFRS Balance Sheet Transformation Report';
    complianceSheet.getCell('A1').font = { bold: true, size: 14 };

    complianceSheet.getCell('A3').value = 'Processing Summary:';
    complianceSheet.getCell('A3').font = { bold: true };

    complianceSheet.getCell('A4').value = `• Total line items processed: ${summary.originalRows}`;
    complianceSheet.getCell('A5').value = `• IFRS transformations applied: ${summary.changes}`;
    complianceSheet.getCell('A6').value = `• Warnings generated: ${summary.warnings.length}`;

    complianceSheet.getCell('A8').value = 'IFRS Compliance Notes:';
    complianceSheet.getCell('A8').font = { bold: true };

    const complianceNotes = [
        'This balance sheet has been transformed from NSBU (National Standards of Bookkeeping of Uzbekistan) format to IFRS format',
        'Account classifications follow IAS 1 - Presentation of Financial Statements',
        'Current/non-current classification follows the 12-month operating cycle test',
        'All amounts are presented in thousands of UZS unless otherwise stated',
        'This transformation provides a mapping to IFRS structure but does not replace the need for full IFRS adjustments',
        'Professional judgment and full IFRS audit are required for official financial statements',
        'Asset impairment testing (IAS 36) should be performed where indicators exist',
        'Fair value measurements may be required for certain financial instruments (IFRS 9)',
        'This report should be reviewed by qualified accounting professionals'
    ];

    complianceNotes.forEach((note, index) => {
        complianceSheet.getCell(`A${10 + index}`).value = `• ${note}`;
    });

    // Auto-fit columns
    complianceSheet.getColumn('A').width = 100;
}

/**
 * Get cell value as string
 */
function getCellValue(cell) {
    if (!cell || cell.value === null || cell.value === undefined) return '';

    if (typeof cell.value === 'object' && cell.value.richText) {
        return cell.value.richText.map(rt => rt.text).join('');
    }

    return String(cell.value).trim();
}

/**
 * Parse numeric value from cell
 */
function parseNumericValue(value) {
    if (typeof value === 'number') return value;
    if (!value) return 0;

    const str = String(value).replace(/[^\d.-]/g, '');
    const parsed = parseFloat(str);

    return isNaN(parsed) ? 0 : parsed;
}

module.exports = {
    processBalanceSheetTemplate
};