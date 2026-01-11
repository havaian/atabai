// utils/stylers/cashFlow.js - PROFESSIONAL TEMPLATE VERSION

const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

/**
 * Professional Cash Flow Statement Styler
 * Creates multi-period format matching industry standards
 */

async function styleCashFlowReport(data) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Cash Flow Statement');

    // Determine period columns - aggregate monthly data into periods
    const periods = aggregateToPeriods(data);
    const periodCount = periods.length;

    // Set column widths: Description column + period columns
    const columns = [{ width: 50 }]; // Description column
    for (let i = 0; i < periodCount; i++) {
        columns.push({ width: 15 }); // Period columns
    }
    worksheet.columns = columns;

    let currentRow = 1;

    // === LOGO AND BRANDING ===
    try {
        const possiblePaths = [
            path.join(__dirname, '../../public/assets/images/icons/logo.png'),
            path.join(__dirname, '../../../frontend/public/images/icons/logo.png'),
            path.join(__dirname, '../../frontend/public/images/icons/logo.png'),
            '/app/public/assets/images/icons/logo.png',
            '/app/frontend/public/images/icons/logo.png'
        ];

        let logoPath = null;
        for (const testPath of possiblePaths) {
            if (fs.existsSync(testPath)) {
                logoPath = testPath;
                break;
            }
        }

        if (logoPath) {
            const imageId = workbook.addImage({
                filename: logoPath,
                extension: 'png',
            });

            worksheet.addImage(imageId, {
                tl: { col: 0, row: 0 },
                ext: { width: 40, height: 40 }
            });

            const companyRow = worksheet.getRow(currentRow);
            companyRow.getCell(2).value = 'ATABAI';
            companyRow.getCell(2).font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FF9500FF' } };
            companyRow.getCell(2).alignment = { horizontal: 'left', vertical: 'center' };
            companyRow.height = 30;
            currentRow += 2;
        }
    } catch (error) {
        global.logger.logWarn('[CF STYLER] Could not load logo:', error.message);
        currentRow += 1;
    }

    // === TITLE ===
    const titleRow = worksheet.getRow(currentRow);
    titleRow.getCell(1).value = 'STATEMENT OF CASH FLOWS (IFRS)';
    titleRow.getCell(1).font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FF1F4E78' } };
    titleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'center' };
    worksheet.mergeCells(currentRow, 1, currentRow, periodCount + 1);
    currentRow++;

    // Company name
    if (data.companyName) {
        const nameRow = worksheet.getRow(currentRow);
        nameRow.getCell(1).value = data.companyName;
        nameRow.getCell(1).font = { name: 'Arial', size: 12, bold: true };
        nameRow.getCell(1).alignment = { horizontal: 'center' };
        worksheet.mergeCells(currentRow, 1, currentRow, periodCount + 1);
        currentRow++;
    }

    // Period
    if (data.period) {
        const periodRow = worksheet.getRow(currentRow);
        periodRow.getCell(1).value = data.period;
        periodRow.getCell(1).font = { name: 'Arial', size: 10 };
        periodRow.getCell(1).alignment = { horizontal: 'center' };
        worksheet.mergeCells(currentRow, 1, currentRow, periodCount + 1);
        currentRow++;
    }

    currentRow++; // Blank line

    // === COLUMN HEADERS ===
    const headerRow = worksheet.getRow(currentRow);
    headerRow.getCell(1).value = 'Cash Flow Statement';
    headerRow.getCell(1).font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.getCell(1).alignment = { horizontal: 'left', vertical: 'center' };
    headerRow.getCell(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1F4E78' } // Professional blue
    };

    // Period headers
    for (let i = 0; i < periodCount; i++) {
        const cell = headerRow.getCell(i + 2);
        cell.value = periods[i].label;
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.alignment = { horizontal: 'center', vertical: 'center' };
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF1F4E78' }
        };
        cell.border = {
            top: { style: 'thin', color: { argb: 'FFFFFFFF' } },
            left: { style: 'thin', color: { argb: 'FFFFFFFF' } },
            bottom: { style: 'thin', color: { argb: 'FFFFFFFF' } },
            right: { style: 'thin', color: { argb: 'FFFFFFFF' } }
        };
    }
    headerRow.height = 25;
    currentRow++;

    // === OPERATING ACTIVITIES ===
    currentRow = addSection(worksheet, currentRow, 'CASH FLOWS FROM OPERATING ACTIVITIES:', periods, data.sections[0], true);
    currentRow = addSectionTotal(worksheet, currentRow, 'Net cash from operating activities', periods, data.operatingTotal);
    currentRow++; // Blank line

    // === INVESTING ACTIVITIES ===
    currentRow = addSection(worksheet, currentRow, 'CASH FLOWS FROM INVESTING ACTIVITIES:', periods, data.sections[1], false);
    currentRow = addSectionTotal(worksheet, currentRow, 'Net cash from investing activities', periods, data.investingTotal);
    currentRow++; // Blank line

    // === FINANCING ACTIVITIES ===
    currentRow = addSection(worksheet, currentRow, 'CASH FLOWS FROM FINANCING ACTIVITIES:', periods, data.sections[2], false);
    currentRow = addSectionTotal(worksheet, currentRow, 'Net cash from financing activities', periods, data.financingTotal);
    currentRow++; // Blank line

    // === RECONCILIATION ===
    currentRow = addReconciliation(worksheet, currentRow, periods, data);

    return workbook;
}

function aggregateToPeriods(data) {
    // For now, create a single "Total" column
    // TODO: In future, split into months/quarters/years based on data
    return [{ label: 'Amount', data: null }];
}

function addSection(worksheet, startRow, sectionTitle, periods, sectionData, isOperating) {
    let currentRow = startRow;

    // Section header
    const headerRow = worksheet.getRow(currentRow);
    headerRow.getCell(1).value = sectionTitle;
    headerRow.getCell(1).font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.getCell(1).alignment = { horizontal: 'left', vertical: 'center', indent: 1 };
    headerRow.getCell(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' } // Professional blue
    };

    // Fill header across all columns
    for (let i = 2; i <= periods.length + 1; i++) {
        headerRow.getCell(i).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4472C4' }
        };
    }
    headerRow.height = 20;
    currentRow++;

    // Line items
    if (sectionData && sectionData.items) {
        for (const item of sectionData.items) {
            const row = worksheet.getRow(currentRow);

            // Line item description with indentation
            const indent = item.indent || 1;
            row.getCell(1).value = item.label;
            row.getCell(1).font = {
                name: 'Arial',
                size: 10,
                bold: item.isGroupHeader || false
            };
            row.getCell(1).alignment = {
                horizontal: 'left',
                vertical: 'center',
                indent: indent + 1
            };

            // Amount
            const amountCell = row.getCell(2);
            amountCell.value = item.amount;
            amountCell.numFmt = '#,##0.00';
            amountCell.alignment = { horizontal: 'right', vertical: 'center' };

            // Color coding for inflows/outflows
            if (item.amount < 0) {
                amountCell.font = { name: 'Arial', size: 10, color: { argb: 'FFFF0000' } }; // Red for outflows
            } else if (item.amount > 0 && !item.isGroupHeader) {
                amountCell.font = { name: 'Arial', size: 10, color: { argb: 'FF008000' } }; // Green for inflows
            } else {
                amountCell.font = { name: 'Arial', size: 10 };
            }

            // Borders
            for (let i = 1; i <= periods.length + 1; i++) {
                row.getCell(i).border = {
                    top: { style: 'thin', color: { argb: 'FFD0D0D0' } },
                    left: { style: 'thin', color: { argb: 'FFD0D0D0' } },
                    bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
                    right: { style: 'thin', color: { argb: 'FFD0D0D0' } }
                };
            }

            currentRow++;
        }
    }

    return currentRow;
}

function addSectionTotal(worksheet, row, label, periods, total) {
    const totalRow = worksheet.getRow(row);

    totalRow.getCell(1).value = label;
    totalRow.getCell(1).font = { name: 'Arial', size: 10, bold: true };
    totalRow.getCell(1).alignment = { horizontal: 'left', vertical: 'center', indent: 1 };
    totalRow.getCell(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE7E6E6' }
    };

    totalRow.getCell(2).value = total;
    totalRow.getCell(2).numFmt = '#,##0.00';
    totalRow.getCell(2).font = { name: 'Arial', size: 10, bold: true };
    totalRow.getCell(2).alignment = { horizontal: 'right', vertical: 'center' };
    totalRow.getCell(2).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE7E6E6' }
    };

    // Borders
    for (let i = 1; i <= periods.length + 1; i++) {
        totalRow.getCell(i).border = {
            top: { style: 'medium', color: { argb: 'FF000000' } },
            left: { style: 'thin', color: { argb: 'FF000000' } },
            bottom: { style: 'double', color: { argb: 'FF000000' } },
            right: { style: 'thin', color: { argb: 'FF000000' } }
        };
    }

    totalRow.height = 22;
    return row + 1;
}

function addReconciliation(worksheet, startRow, periods, data) {
    let currentRow = startRow;

    // Net increase line
    const netRow = worksheet.getRow(currentRow);
    netRow.getCell(1).value = 'Net increase/(decrease) in cash and cash equivalents';
    netRow.getCell(1).font = { name: 'Arial', size: 10, bold: true };
    netRow.getCell(1).alignment = { horizontal: 'left', vertical: 'center', indent: 1 };

    netRow.getCell(2).value = data.netChange;
    netRow.getCell(2).numFmt = '#,##0.00';
    netRow.getCell(2).font = { name: 'Arial', size: 10, bold: true };
    netRow.getCell(2).alignment = { horizontal: 'right', vertical: 'center' };

    for (let i = 1; i <= periods.length + 1; i++) {
        netRow.getCell(i).border = {
            top: { style: 'thin' },
            bottom: { style: 'thin' }
        };
    }
    currentRow++;

    // FX effects (if non-zero)
    if (Math.abs(data.fxEffects) > 0.01) {
        const fxRow = worksheet.getRow(currentRow);
        fxRow.getCell(1).value = 'Effect of exchange rate changes';
        fxRow.getCell(1).font = { name: 'Arial', size: 10 };
        fxRow.getCell(1).alignment = { horizontal: 'left', vertical: 'center', indent: 1 };

        fxRow.getCell(2).value = data.fxEffects;
        fxRow.getCell(2).numFmt = '#,##0.00';
        fxRow.getCell(2).alignment = { horizontal: 'right', vertical: 'center' };
        currentRow++;
    }

    // Beginning balance
    const beginRow = worksheet.getRow(currentRow);
    beginRow.getCell(1).value = 'Cash and cash equivalents at beginning of period';
    beginRow.getCell(1).font = { name: 'Arial', size: 10 };
    beginRow.getCell(1).alignment = { horizontal: 'left', vertical: 'center', indent: 1 };

    beginRow.getCell(2).value = data.cashBeginning;
    beginRow.getCell(2).numFmt = '#,##0.00';
    beginRow.getCell(2).alignment = { horizontal: 'right', vertical: 'center' };
    currentRow++;

    // Ending balance
    const endRow = worksheet.getRow(currentRow);
    endRow.getCell(1).value = 'Cash and cash equivalents at end of period';
    endRow.getCell(1).font = { name: 'Arial', size: 11, bold: true };
    endRow.getCell(1).alignment = { horizontal: 'left', vertical: 'center', indent: 1 };
    endRow.getCell(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' }
    };
    endRow.getCell(1).font.color = { argb: 'FFFFFFFF' };

    endRow.getCell(2).value = data.cashEnding;
    endRow.getCell(2).numFmt = '#,##0.00';
    endRow.getCell(2).font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    endRow.getCell(2).alignment = { horizontal: 'right', vertical: 'center' };
    endRow.getCell(2).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' }
    };

    for (let i = 1; i <= periods.length + 1; i++) {
        endRow.getCell(i).border = {
            top: { style: 'medium' },
            bottom: { style: 'double' }
        };
    }
    endRow.height = 22;

    return currentRow + 1;
}

module.exports = {
    styleCashFlowReport
};