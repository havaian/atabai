// utils/cashFlowStyler.js

const ExcelJS = require('exceljs');

/**
 * Style Cash Flow Report
 * Creates a professionally styled IFRS cash flow statement
 */

function styleCashFlowReport(data) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Cash Flow Statement');

    // Set column widths
    worksheet.columns = [
        { width: 50 },  // Line Item
        { width: 20 }   // Amount
    ];

    let currentRow = 1;

    // Title
    const titleRow = worksheet.getRow(currentRow);
    titleRow.getCell(1).value = data.title;
    titleRow.getCell(1).font = { bold: true, size: 14 };
    titleRow.getCell(1).alignment = { horizontal: 'center' };
    worksheet.mergeCells(currentRow, 1, currentRow, 2);
    currentRow += 2;

    // Company info
    if (data.companyName) {
        worksheet.getRow(currentRow).getCell(1).value = data.companyName;
        worksheet.getRow(currentRow).getCell(1).font = { bold: true };
        currentRow++;
    }

    if (data.period) {
        worksheet.getRow(currentRow).getCell(1).value = data.period;
        currentRow++;
    }

    if (data.inn) {
        worksheet.getRow(currentRow).getCell(1).value = `INN: ${data.inn}`;
        currentRow++;
    }

    currentRow++; // Blank line

    // Headers
    const headerRow = worksheet.getRow(currentRow);
    headerRow.getCell(1).value = 'Cash Flow Item';
    headerRow.getCell(2).value = 'Amount';
    headerRow.font = { bold: true };
    headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
    };
    headerRow.border = {
        bottom: { style: 'thin' }
    };
    currentRow++;

    // Sections
    data.sections.forEach(section => {
        // Section header
        const sectionRow = worksheet.getRow(currentRow);
        sectionRow.getCell(1).value = section.name;
        sectionRow.font = { bold: true };
        sectionRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF0F0F0' }
        };
        currentRow++;

        // Section items
        section.items.forEach(item => {
            const itemRow = worksheet.getRow(currentRow);
            itemRow.getCell(1).value = item.label;
            itemRow.getCell(2).value = item.amount;
            itemRow.getCell(2).numFmt = '#,##0.00';

            // Indent non-subtotal items
            if (item.flowType !== 'subtotal' && item.flowType !== 'total') {
                itemRow.getCell(1).alignment = { indent: 2 };
            } else {
                itemRow.font = { bold: true };
            }

            currentRow++;
        });

        // Section subtotal (if not already in items)
        if (section.name !== 'RECONCILIATION') {
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
                subtotalRow.font = { bold: true };
                subtotalRow.border = {
                    top: { style: 'thin' },
                    bottom: { style: 'double' }
                };
                currentRow++;
            }
        }

        currentRow++; // Blank line between sections
    });

    // Summary
    const summaryStartRow = currentRow;

    // Net change
    const netChangeRow = worksheet.getRow(currentRow);
    netChangeRow.getCell(1).value = 'Net increase/(decrease) in cash and cash equivalents';
    netChangeRow.getCell(2).value = data.netChange;
    netChangeRow.getCell(2).numFmt = '#,##0.00';
    netChangeRow.font = { bold: true };
    currentRow++;

    // FX effects
    if (data.fxEffects !== 0) {
        const fxRow = worksheet.getRow(currentRow);
        fxRow.getCell(1).value = 'Effect of exchange rate changes';
        fxRow.getCell(2).value = data.fxEffects;
        fxRow.getCell(2).numFmt = '#,##0.00';
        currentRow++;
    }

    // Cash beginning
    const beginRow = worksheet.getRow(currentRow);
    beginRow.getCell(1).value = 'Cash and cash equivalents at beginning of period';
    beginRow.getCell(2).value = data.cashBeginning;
    beginRow.getCell(2).numFmt = '#,##0.00';
    currentRow++;

    // Cash ending
    const endRow = worksheet.getRow(currentRow);
    endRow.getCell(1).value = 'Cash and cash equivalents at end of period';
    endRow.getCell(2).value = data.cashEnding;
    endRow.getCell(2).numFmt = '#,##0.00';
    endRow.font = { bold: true };
    endRow.border = {
        top: { style: 'thin' },
        bottom: { style: 'double' }
    };
    endRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFEB3B' }
    };
    currentRow++;

    return workbook;
}

module.exports = {
    styleCashFlowReport
};