const ExcelJS = require('exceljs');

/**
 * Universal Excel Styler Module
 * Handles all formatting and styling for IFRS reports
 * Separates data generation from presentation
 */

// Define style presets
const STYLE_PRESETS = {
    // Professional IFRS balance sheet style
    balanceSheet: {
        title: {
            font: { name: 'Arial', size: 14, bold: true },
            alignment: { horizontal: 'center', vertical: 'center' },
            fill: null
        },
        subtitle: {
            font: { name: 'Arial', size: 12, bold: true },
            alignment: { horizontal: 'center', vertical: 'center' },
            fill: null
        },
        metadata: {
            font: { name: 'Arial', size: 10 },
            alignment: { horizontal: 'center', vertical: 'center' },
            fill: null
        },
        columnHeader: {
            font: { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } },
            alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF366092' } },
            border: {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            }
        },
        sectionHeader: {
            font: { name: 'Arial', size: 11, bold: true },
            alignment: { horizontal: 'left', vertical: 'center' },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } },
            border: {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            }
        },
        dataCell: {
            font: { name: 'Arial', size: 10 },
            alignment: { horizontal: 'left', vertical: 'center' },
            fill: null,
            border: {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            }
        },
        numberCell: {
            font: { name: 'Arial', size: 10 },
            alignment: { horizontal: 'right', vertical: 'center' },
            fill: null,
            border: {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            },
            numFmt: '#,##0.00'
        },
        totalRow: {
            font: { name: 'Arial', size: 10, bold: true },
            alignment: { horizontal: 'right', vertical: 'center' },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } },
            border: {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            },
            numFmt: '#,##0.00'
        },
        grandTotal: {
            font: { name: 'Arial', size: 11, bold: true },
            alignment: { horizontal: 'right', vertical: 'center' },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7E6E6' } },
            border: {
                top: { style: 'medium' },
                left: { style: 'thin' },
                bottom: { style: 'medium' },
                right: { style: 'thin' }
            },
            numFmt: '#,##0.00'
        }
    },

    // Simple flat report style (for depreciation, discounts, etc.)
    flatReport: {
        title: {
            font: { name: 'Calibri', size: 11, bold: false },
            alignment: { horizontal: 'left', vertical: 'center' },
            fill: null
        },
        columnHeader: {
            font: { name: 'Calibri', size: 11, bold: false },
            alignment: { horizontal: 'left', vertical: 'center' },
            fill: null,
            border: null
        },
        dataCell: {
            font: { name: 'Calibri', size: 11, bold: false },
            alignment: { horizontal: 'left', vertical: 'center' },
            fill: null,
            border: null
        },
        numberCell: {
            font: { name: 'Calibri', size: 11, bold: false },
            alignment: { horizontal: 'right', vertical: 'center' },
            fill: null,
            border: null,
            numFmt: '#,##0.00'
        }
    }
};

/**
 * Apply style to a cell or range of cells
 */
function applyStyle(cell, styleConfig) {
    if (!styleConfig) return;

    if (styleConfig.font) {
        cell.font = styleConfig.font;
    }

    if (styleConfig.alignment) {
        cell.alignment = styleConfig.alignment;
    }

    if (styleConfig.fill) {
        cell.fill = styleConfig.fill;
    }

    if (styleConfig.border) {
        cell.border = styleConfig.border;
    }

    if (styleConfig.numFmt) {
        cell.numFmt = styleConfig.numFmt;
    }
}

/**
 * Apply style to a range of cells
 */
function applyStyleToRange(worksheet, startRow, startCol, endRow, endCol, styleConfig) {
    for (let row = startRow; row <= endRow; row++) {
        for (let col = startCol; col <= endCol; col++) {
            const cell = worksheet.getRow(row).getCell(col);
            applyStyle(cell, styleConfig);
        }
    }
}

/**
 * Create styled balance sheet
 * @param {Object} data - Balance sheet data structure
 * @param {string} data.title - Report title
 * @param {string} data.companyName - Company name
 * @param {string} data.reportDate - Report date
 * @param {string} data.inn - INN number
 * @param {Array} data.sections - Array of sections with items
 * @returns {ExcelJS.Workbook}
 */
function createStyledBalanceSheet(data) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('IFRS Statement');

    const styles = STYLE_PRESETS.balanceSheet;
    let currentRow = 1;

    // === HEADER SECTION ===

    // Title row
    worksheet.mergeCells(`A${currentRow}:E${currentRow}`);
    const titleCell = worksheet.getCell(`A${currentRow}`);
    titleCell.value = data.title || 'STATEMENT OF FINANCIAL POSITION (IFRS)';
    applyStyle(titleCell, styles.title);
    currentRow++;

    // Company name
    worksheet.mergeCells(`A${currentRow}:E${currentRow}`);
    const companyCell = worksheet.getCell(`A${currentRow}`);
    companyCell.value = data.companyName;
    applyStyle(companyCell, styles.subtitle);
    currentRow++;

    // Report date
    worksheet.mergeCells(`A${currentRow}:E${currentRow}`);
    const dateCell = worksheet.getCell(`A${currentRow}`);
    dateCell.value = `As at ${data.reportDate}`;
    applyStyle(dateCell, styles.metadata);
    currentRow++;

    // INN
    worksheet.mergeCells(`A${currentRow}:E${currentRow}`);
    const innCell = worksheet.getCell(`A${currentRow}`);
    innCell.value = `INN: ${data.inn}`;
    applyStyle(innCell, styles.metadata);
    currentRow++;

    // Empty row
    currentRow++;

    // === COLUMN HEADERS ===
    const headers = ['IFRS Code', 'Line Item', 'NSBU Code', 'Beginning Balance (sum)', 'Ending Balance (sum)'];
    const headerRow = worksheet.getRow(currentRow);

    headers.forEach((header, index) => {
        const cell = headerRow.getCell(index + 1);
        cell.value = header;
        applyStyle(cell, styles.columnHeader);
    });
    currentRow++;

    // === DATA SECTIONS ===
    data.sections.forEach(section => {
        // Section header
        worksheet.mergeCells(`A${currentRow}:E${currentRow}`);
        const sectionCell = worksheet.getCell(`A${currentRow}`);
        sectionCell.value = section.name;
        applyStyle(sectionCell, styles.sectionHeader);
        currentRow++;

        // Section items
        section.items.forEach(item => {
            const row = worksheet.getRow(currentRow);

            // IFRS Code
            const codeCell = row.getCell(1);
            codeCell.value = item.code;
            applyStyle(codeCell, styles.dataCell);

            // Line Item
            const labelCell = row.getCell(2);
            labelCell.value = item.label;
            applyStyle(labelCell, styles.dataCell);

            // NSBU Code
            const nsbuCell = row.getCell(3);
            nsbuCell.value = item.nsbuCode || item.code;
            applyStyle(nsbuCell, styles.dataCell);

            // Beginning Balance
            const startCell = row.getCell(4);
            startCell.value = item.start;
            applyStyle(startCell, styles.numberCell);

            // Ending Balance
            const endCell = row.getCell(5);
            endCell.value = item.end;
            applyStyle(endCell, styles.numberCell);

            currentRow++;
        });

        // Section total
        if (section.totalStart !== undefined && section.totalEnd !== undefined) {
            const totalRow = worksheet.getRow(currentRow);

            totalRow.getCell(1).value = '';
            applyStyle(totalRow.getCell(1), styles.totalRow);

            totalRow.getCell(2).value = `Total ${section.name}`;
            applyStyle(totalRow.getCell(2), styles.totalRow);
            totalRow.getCell(2).alignment = { horizontal: 'left', vertical: 'center' };

            totalRow.getCell(3).value = '';
            applyStyle(totalRow.getCell(3), styles.totalRow);

            totalRow.getCell(4).value = section.totalStart;
            applyStyle(totalRow.getCell(4), styles.totalRow);

            totalRow.getCell(5).value = section.totalEnd;
            applyStyle(totalRow.getCell(5), styles.totalRow);

            currentRow++;
        }

        // Empty row after section
        currentRow++;
    });

    // === GRAND TOTALS ===
    if (data.totalAssetsStart !== undefined) {
        const totalAssetsRow = worksheet.getRow(currentRow);

        worksheet.mergeCells(`A${currentRow}:C${currentRow}`);
        const labelCell = totalAssetsRow.getCell(1);
        labelCell.value = 'TOTAL ASSETS';
        applyStyle(labelCell, styles.grandTotal);
        labelCell.alignment = { horizontal: 'left', vertical: 'center' };

        totalAssetsRow.getCell(4).value = data.totalAssetsStart;
        applyStyle(totalAssetsRow.getCell(4), styles.grandTotal);

        totalAssetsRow.getCell(5).value = data.totalAssetsEnd;
        applyStyle(totalAssetsRow.getCell(5), styles.grandTotal);

        currentRow++;
    }

    if (data.totalEquityLiabStart !== undefined) {
        const totalEquityRow = worksheet.getRow(currentRow);

        worksheet.mergeCells(`A${currentRow}:C${currentRow}`);
        const labelCell = totalEquityRow.getCell(1);
        labelCell.value = 'TOTAL EQUITY AND LIABILITIES';
        applyStyle(labelCell, styles.grandTotal);
        labelCell.alignment = { horizontal: 'left', vertical: 'center' };

        totalEquityRow.getCell(4).value = data.totalEquityLiabStart;
        applyStyle(totalEquityRow.getCell(4), styles.grandTotal);

        totalEquityRow.getCell(5).value = data.totalEquityLiabEnd;
        applyStyle(totalEquityRow.getCell(5), styles.grandTotal);

        currentRow++;
    }

    // === COLUMN WIDTHS ===
    worksheet.getColumn(1).width = 15;  // IFRS Code
    worksheet.getColumn(2).width = 50;  // Line Item
    worksheet.getColumn(3).width = 15;  // NSBU Code
    worksheet.getColumn(4).width = 20;  // Beginning Balance
    worksheet.getColumn(5).width = 20;  // Ending Balance

    return workbook;
}

/**
 * Create flat styled report (simple 3-column format)
 * @param {Object} data - Report data structure
 * @param {string} data.title - Report title
 * @param {string} data.subtitle - Report subtitle
 * @param {string} data.unit - Unit of measurement
 * @param {Array} data.headers - Column headers
 * @param {Array} data.rows - Data rows
 * @returns {ExcelJS.Workbook}
 */
function createFlatReport(data) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(data.sheetName || 'Report');

    const styles = STYLE_PRESETS.flatReport;
    let currentRow = 1;

    // Title
    if (data.title) {
        const titleRow = worksheet.getRow(currentRow);
        titleRow.getCell(1).value = data.title;
        applyStyle(titleRow.getCell(1), styles.title);
        currentRow++;
    }

    // Subtitle
    if (data.subtitle) {
        const subtitleRow = worksheet.getRow(currentRow);
        subtitleRow.getCell(1).value = data.subtitle;
        applyStyle(subtitleRow.getCell(1), styles.title);
        currentRow++;
    }

    // Unit
    if (data.unit) {
        const unitRow = worksheet.getRow(currentRow);
        unitRow.getCell(1).value = `Unit: ${data.unit}`;
        applyStyle(unitRow.getCell(1), styles.title);
        currentRow++;
    }

    // Empty row
    currentRow++;

    // Headers
    if (data.headers && data.headers.length > 0) {
        const headerRow = worksheet.getRow(currentRow);
        data.headers.forEach((header, index) => {
            const cell = headerRow.getCell(index + 1);
            cell.value = header;
            applyStyle(cell, styles.columnHeader);
        });
        currentRow++;
    }

    // Data rows
    if (data.rows && data.rows.length > 0) {
        data.rows.forEach(row => {
            const excelRow = worksheet.getRow(currentRow);

            row.forEach((value, index) => {
                const cell = excelRow.getCell(index + 1);
                cell.value = value;

                // Apply number formatting to numeric columns (except first column which is usually text)
                if (index > 0 && typeof value === 'number') {
                    applyStyle(cell, styles.numberCell);
                } else {
                    applyStyle(cell, styles.dataCell);
                }
            });

            currentRow++;
        });
    }

    // Set column widths based on headers
    if (data.columnWidths) {
        data.columnWidths.forEach((width, index) => {
            worksheet.getColumn(index + 1).width = width;
        });
    } else {
        // Default widths
        worksheet.getColumn(1).width = 45;
        for (let i = 2; i <= (data.headers?.length || 3); i++) {
            worksheet.getColumn(i).width = 18;
        }
    }

    return workbook;
}

/**
 * Main styler function - routes to appropriate style based on report type
 */
function styleReport(data, reportType) {
    switch (reportType) {
        case 'balanceSheet':
            return createStyledBalanceSheet(data);

        case 'flat':
        case 'depreciation':
        case 'discounts':
        case 'impairment':
            return createFlatReport(data);

        default:
            throw new Error(`Unknown report type: ${reportType}`);
    }
}

module.exports = {
    styleReport,
    createStyledBalanceSheet,
    createFlatReport,
    STYLE_PRESETS
};