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
    let dataStartRow = null;
    let codeColumn = null;
    
    // Search MORE rows - up to row 50
    for (let rowNum = 1; rowNum <= Math.min(50, worksheet.rowCount); rowNum++) {
        const row = worksheet.getRow(rowNum);
        
        row.eachCell((cell, colNumber) => {
            const cellValue = cell.value?.toString().toLowerCase() || '';
            
            // Look for "код стр" or "актив"
            if (cellValue.includes('код стр') || cellValue.includes('код стр.')) {
                codeColumn = colNumber;
                dataStartRow = rowNum + 1; // Data starts next row
                global.logger.logInfo(`Found code column at row ${rowNum}, col ${colNumber}`);
            }
            
            if (cellValue === 'актив' || cellValue.includes('актив')) {
                if (!dataStartRow) {
                    dataStartRow = rowNum + 1;
                }
                global.logger.logInfo(`Found 'Актив' at row ${rowNum}`);
            }
        });
        
        if (dataStartRow && codeColumn) break;
    }
    
    if (!dataStartRow || !codeColumn) {
        throw new Error('Could not detect balance sheet structure');
    }
    
    return { dataStartRow, codeColumn };
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