// utils/stylers/cashFlow.js

const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

/**
 * Style Cash Flow Report - Enhanced Version
 * Creates a professionally styled IFRS cash flow statement with detailed line items
 * Matches balanceSheet design aesthetics with company branding
 */

async function styleCashFlowReport(data) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Cash Flow Statement');

    // Set column widths
    worksheet.columns = [
        { width: 60 },  // Line Item (wider for detailed names)
        { width: 20 }   // Amount
    ];

    let currentRow = 1;

    // === LOGO AND COMPANY BRANDING ===
    try {
        // Try multiple possible paths for the logo
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
                console.log(`[CF STYLER] Logo found at: ${logoPath}`);
                break;
            }
        }

        if (logoPath) {
            const imageId = workbook.addImage({
                filename: logoPath,
                extension: 'png',
            });

            // Add logo to top-left (square dimensions to match actual image 3299x3190)
            worksheet.addImage(imageId, {
                tl: { col: 0, row: 0 },
                ext: { width: 40, height: 40 }  // Square dimensions for square logo
            });

            // Company name next to logo
            const companyRow = worksheet.getRow(currentRow);
            companyRow.getCell(2).value = 'ATABAI';
            companyRow.getCell(2).font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FF9500FF' } };
            companyRow.getCell(2).alignment = { horizontal: 'left', vertical: 'center' };
            companyRow.height = 30;
            currentRow += 2;
        } else {
            console.warn('[CF STYLER] Logo not found in any expected location');
            // Add company name without logo
            const companyRow = worksheet.getRow(currentRow);
            companyRow.getCell(1).value = 'ATABAI';
            companyRow.getCell(1).font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FF9500FF' } };
            companyRow.getCell(1).alignment = { horizontal: 'center', vertical: 'center' };
            worksheet.mergeCells(currentRow, 1, currentRow, 2);
            currentRow += 2;
        }
    } catch (error) {
        console.warn('[CF STYLER] Could not load logo:', error.message);
        // Add company name as fallback
        const companyRow = worksheet.getRow(currentRow);
        companyRow.getCell(1).value = 'ATABAI';
        companyRow.getCell(1).font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FF9500FF' } };
        companyRow.getCell(1).alignment = { horizontal: 'center', vertical: 'center' };
        worksheet.mergeCells(currentRow, 1, currentRow, 2);
        currentRow += 2;
    }

    // === TITLE SECTION ===
    const titleRow = worksheet.getRow(currentRow);
    titleRow.getCell(1).value = data.title;
    titleRow.getCell(1).font = { name: 'Arial', size: 14, bold: true };
    titleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'center' };
    worksheet.mergeCells(currentRow, 1, currentRow, 2);
    currentRow += 2;

    // Company info
    if (data.companyName) {
        const companyNameRow = worksheet.getRow(currentRow);
        companyNameRow.getCell(1).value = data.companyName;
        companyNameRow.getCell(1).font = { name: 'Arial', size: 12, bold: true };
        companyNameRow.getCell(1).alignment = { horizontal: 'center', vertical: 'center' };
        worksheet.mergeCells(currentRow, 1, currentRow, 2);
        currentRow++;
    }

    if (data.period) {
        const periodRow = worksheet.getRow(currentRow);
        periodRow.getCell(1).value = data.period;
        periodRow.getCell(1).font = { name: 'Arial', size: 10 };
        periodRow.getCell(1).alignment = { horizontal: 'center', vertical: 'center' };
        worksheet.mergeCells(currentRow, 1, currentRow, 2);
        currentRow++;
    }

    if (data.inn) {
        const innRow = worksheet.getRow(currentRow);
        innRow.getCell(1).value = `INN: ${data.inn}`;
        innRow.getCell(1).font = { name: 'Arial', size: 10 };
        innRow.getCell(1).alignment = { horizontal: 'center', vertical: 'center' };
        worksheet.mergeCells(currentRow, 1, currentRow, 2);
        currentRow++;
    }

    currentRow++; // Blank line

    // === COLUMN HEADERS ===
    const headerRow = worksheet.getRow(currentRow);
    headerRow.getCell(1).value = 'Cash Flow Item';
    headerRow.getCell(2).value = 'Amount';
    headerRow.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.alignment = { horizontal: 'center', vertical: 'center', wrapText: true };
    headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF366092' }
    };
    headerRow.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
    };
    headerRow.height = 25;
    currentRow++;

    // === SECTIONS ===
    data.sections.forEach(section => {
        // Section header
        const sectionRow = worksheet.getRow(currentRow);
        sectionRow.getCell(1).value = section.name;
        sectionRow.getCell(1).font = { name: 'Arial', size: 11, bold: true };
        sectionRow.getCell(1).alignment = { horizontal: 'left', vertical: 'center' };
        sectionRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFD9E1F2' }
        };
        sectionRow.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
        };
        worksheet.mergeCells(currentRow, 1, currentRow, 2);
        currentRow++;

        // Section items
        section.items.forEach(item => {
            const itemRow = worksheet.getRow(currentRow);

            // Apply indentation
            const indentLevel = item.indent || 0;
            const indentSpaces = '  '.repeat(indentLevel);

            // Check if this is a sub-item
            if (item.isSubItem) {
                itemRow.getCell(1).value = `${indentSpaces}• ${item.label}`;
                itemRow.getCell(1).font = { name: 'Arial', size: 10, color: { argb: 'FF666666' } };
                itemRow.getCell(1).alignment = { horizontal: 'left', vertical: 'center', indent: indentLevel + 2 };
            } else if (item.isGroupHeader) {
                itemRow.getCell(1).value = item.label;
                itemRow.getCell(1).font = { name: 'Arial', size: 10, bold: true };
                itemRow.getCell(1).alignment = { horizontal: 'left', vertical: 'center', indent: indentLevel };
            } else {
                itemRow.getCell(1).value = item.label;
                itemRow.getCell(1).font = { name: 'Arial', size: 10 };
                itemRow.getCell(1).alignment = { horizontal: 'left', vertical: 'center', indent: indentLevel };
            }

            // Amount formatting
            itemRow.getCell(2).value = item.amount;
            itemRow.getCell(2).numFmt = '#,##0.00';
            itemRow.getCell(2).alignment = { horizontal: 'right', vertical: 'center' };

            // Color code based on flow type
            if (item.flowType === 'inflow' && !item.isSubItem) {
                itemRow.getCell(2).font = { name: 'Arial', size: 10, color: { argb: 'FF008000' } }; // Green for inflows
            } else if (item.flowType === 'outflow' && !item.isSubItem) {
                itemRow.getCell(2).font = { name: 'Arial', size: 10, color: { argb: 'FFCC0000' } }; // Red for outflows
            } else {
                itemRow.getCell(2).font = { name: 'Arial', size: 10 };
            }

            // Add borders
            itemRow.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };

            currentRow++;
        });

        currentRow++; // Blank line between sections

        // Section subtotal
        const subtotalRow = worksheet.getRow(currentRow);
        let subtotalLabel = '';
        let subtotalValue = 0;

        if (section.name === 'OPERATING ACTIVITIES') {
            subtotalLabel = 'Net cash from operating activities';
            subtotalValue = data.operatingTotal;
        } else if (section.name === 'INVESTING ACTIVITIES') {
            subtotalLabel = 'Net cash from investing activities';
            subtotalValue = data.investingTotal;
        } else if (section.name === 'FINANCING ACTIVITIES') {
            subtotalLabel = 'Net cash from financing activities';
            subtotalValue = data.financingTotal;
        }

        if (subtotalLabel) {
            subtotalRow.getCell(1).value = subtotalLabel;
            subtotalRow.getCell(2).value = subtotalValue;
            subtotalRow.getCell(2).numFmt = '#,##0.00';
            subtotalRow.font = { name: 'Arial', size: 10, bold: true };
            subtotalRow.alignment = { horizontal: 'right', vertical: 'center' };
            subtotalRow.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'double' },
                right: { style: 'thin' }
            };
            subtotalRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFF2F2F2' }
            };
            currentRow++;
        }

        currentRow++; // Blank line between sections
    });

    // === RECONCILIATION SECTION ===
    currentRow++;
    const summaryHeaderRow = worksheet.getRow(currentRow);
    summaryHeaderRow.getCell(1).value = 'RECONCILIATION';
    summaryHeaderRow.font = { name: 'Arial', size: 11, bold: true };
    summaryHeaderRow.alignment = { horizontal: 'left', vertical: 'center' };
    summaryHeaderRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD9E1F2' }
    };
    summaryHeaderRow.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
    };
    worksheet.mergeCells(currentRow, 1, currentRow, 2);
    currentRow++;

    // Net change
    const netChangeRow = worksheet.getRow(currentRow);
    netChangeRow.getCell(1).value = 'Net increase/(decrease) in cash and cash equivalents';
    netChangeRow.getCell(1).font = { name: 'Arial', size: 10, bold: true };
    netChangeRow.getCell(1).alignment = { horizontal: 'left', vertical: 'center' };
    netChangeRow.getCell(2).value = data.netChange;
    netChangeRow.getCell(2).numFmt = '#,##0.00';
    netChangeRow.getCell(2).font = { name: 'Arial', size: 10, bold: true };
    netChangeRow.getCell(2).alignment = { horizontal: 'right', vertical: 'center' };
    netChangeRow.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
    };
    currentRow++;

    // FX effects (if non-zero)
    if (data.fxEffects !== 0) {
        const fxRow = worksheet.getRow(currentRow);
        fxRow.getCell(1).value = 'Effect of exchange rate changes';
        fxRow.getCell(1).font = { name: 'Arial', size: 10 };
        fxRow.getCell(1).alignment = { horizontal: 'left', vertical: 'center' };
        fxRow.getCell(2).value = data.fxEffects;
        fxRow.getCell(2).numFmt = '#,##0.00';
        fxRow.getCell(2).alignment = { horizontal: 'right', vertical: 'center' };
        fxRow.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
        };
        currentRow++;
    }

    // Cash beginning
    const beginRow = worksheet.getRow(currentRow);
    beginRow.getCell(1).value = 'Cash and cash equivalents at beginning of period';
    beginRow.getCell(1).font = { name: 'Arial', size: 10 };
    beginRow.getCell(1).alignment = { horizontal: 'left', vertical: 'center' };
    beginRow.getCell(2).value = data.cashBeginning;
    beginRow.getCell(2).numFmt = '#,##0.00';
    beginRow.getCell(2).alignment = { horizontal: 'right', vertical: 'center' };
    beginRow.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
    };
    currentRow++;

    // Cash ending
    const endRow = worksheet.getRow(currentRow);
    endRow.getCell(1).value = 'Cash and cash equivalents at end of period';
    endRow.getCell(1).font = { name: 'Arial', size: 11, bold: true };
    endRow.getCell(1).alignment = { horizontal: 'left', vertical: 'center' };
    endRow.getCell(2).value = data.cashEnding;
    endRow.getCell(2).numFmt = '#,##0.00';
    endRow.getCell(2).font = { name: 'Arial', size: 11, bold: true };
    endRow.getCell(2).alignment = { horizontal: 'right', vertical: 'center' };
    endRow.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'medium' },
        right: { style: 'thin' }
    };
    endRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE7E6E6' }
    };

    return workbook;
}

module.exports = {
    styleCashFlowReport
};