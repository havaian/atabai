const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

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
 * Format date to dd.mm.yyyy
 * @param {string|Date} dateInput - Date string or Date object
 * @returns {string} Formatted date string
 */
function formatDateToDDMMYYYY(dateInput) {
    if (!dateInput) return new Date().toLocaleDateString('en-GB').replace(/\//g, '.');

    let date;

    // Handle different input types
    if (dateInput instanceof Date) {
        date = dateInput;
    } else if (typeof dateInput === 'string') {
        // Try to parse various date formats
        // Formats: dd.mm.yyyy, dd/mm/yyyy, dd-mm-yyyy, yyyy-mm-dd
        const parts = dateInput.match(/(\d{1,2})[-./](\d{1,2})[-./](\d{4})/);
        if (parts) {
            // dd.mm.yyyy or dd/mm/yyyy or dd-mm-yyyy
            date = new Date(parts[3], parts[2] - 1, parts[1]);
        } else {
            // Try yyyy-mm-dd format
            const isoMatch = dateInput.match(/(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
            if (isoMatch) {
                date = new Date(isoMatch[1], isoMatch[2] - 1, isoMatch[3]);
            } else {
                // Fallback: try to parse as-is
                date = new Date(dateInput);
            }
        }
    } else {
        date = new Date();
    }

    // Check if date is valid
    if (isNaN(date.getTime())) {
        date = new Date();
    }

    // Format to dd.mm.yyyy
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    return `${day}.${month}.${year}`;
}

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
 * Create styled balance sheet with formulas
 * @param {Object} data - Balance sheet data structure
 * @param {string} data.title - Report title
 * @param {string} data.companyName - Company name
 * @param {string} data.reportDate - Report date
 * @param {string} data.inn - INN number
 * @param {Array} data.sections - Array of sections with items
 * @returns {ExcelJS.Workbook}
 */
async function createStyledBalanceSheet(data) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('IFRS Statement');

    const styles = STYLE_PRESETS.balanceSheet;
    let currentRow = 1;

    // Track section total rows for grand total formulas
    const assetSectionTotalRows = [];
    const equityLiabSectionTotalRows = [];

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
                console.log(`[BALANCE SHEET STYLER] Logo found at: ${logoPath}`);
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
            console.warn('[BALANCE SHEET STYLER] Logo not found in any expected location');
            // Add company name without logo
            const companyRow = worksheet.getRow(currentRow);
            companyRow.getCell(1).value = 'ATABAI';
            companyRow.getCell(1).font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FF9500FF' } };
            companyRow.getCell(1).alignment = { horizontal: 'center', vertical: 'center' };
            worksheet.mergeCells(`A${currentRow}:C${currentRow}`);
            currentRow += 2;
        }
    } catch (error) {
        console.warn('[BALANCE SHEET STYLER] Could not load logo:', error.message);
        // Add company name as fallback
        const companyRow = worksheet.getRow(currentRow);
        companyRow.getCell(1).value = 'ATABAI';
        companyRow.getCell(1).font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FF9500FF' } };
        companyRow.getCell(1).alignment = { horizontal: 'center', vertical: 'center' };
        worksheet.mergeCells(`A${currentRow}:C${currentRow}`);
        currentRow += 2;
    }

    // === HEADER SECTION ===

    // Title row
    worksheet.mergeCells(`A${currentRow}:C${currentRow}`);
    const titleCell = worksheet.getCell(`A${currentRow}`);
    titleCell.value = data.title || 'STATEMENT OF FINANCIAL POSITION (IFRS)';
    applyStyle(titleCell, styles.title);
    currentRow++;

    // Company name
    worksheet.mergeCells(`A${currentRow}:C${currentRow}`);
    const companyCell = worksheet.getCell(`A${currentRow}`);
    companyCell.value = data.companyName;
    applyStyle(companyCell, styles.subtitle);
    currentRow++;

    // Report date
    worksheet.mergeCells(`A${currentRow}:C${currentRow}`);
    const dateCell = worksheet.getCell(`A${currentRow}`);
    dateCell.value = `As at ${formatDateToDDMMYYYY(data.reportDate)}`;
    applyStyle(dateCell, styles.metadata);
    currentRow++;

    // INN
    worksheet.mergeCells(`A${currentRow}:C${currentRow}`);
    const innCell = worksheet.getCell(`A${currentRow}`);
    innCell.value = `INN: ${data.inn}`;
    applyStyle(innCell, styles.metadata);
    currentRow++;

    // Empty row
    currentRow++;

    // === COLUMN HEADERS ===
    const headers = ['Line Item', 'Beginning Balance (sum)', 'Ending Balance (sum)'];
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
        worksheet.mergeCells(`A${currentRow}:C${currentRow}`);
        const sectionCell = worksheet.getCell(`A${currentRow}`);
        sectionCell.value = section.name;
        applyStyle(sectionCell, styles.sectionHeader);
        currentRow++;

        // Track first and last data row for this section
        const sectionStartRow = currentRow;

        // Section items
        section.items.forEach(item => {
            const row = worksheet.getRow(currentRow);

            // // IFRS Code
            // const codeCell = row.getCell(1);
            // codeCell.value = item.code;
            // applyStyle(codeCell, styles.dataCell);

            // Line Item
            const labelCell = row.getCell(1);
            labelCell.value = item.label;
            applyStyle(labelCell, styles.dataCell);

            // // NSBU Code
            // const nsbuCell = row.getCell(3);
            // nsbuCell.value = item.nsbuCode || item.code;
            // applyStyle(nsbuCell, styles.dataCell);

            // Beginning Balance
            const startCell = row.getCell(2);
            startCell.value = item.start;
            applyStyle(startCell, styles.numberCell);

            // Ending Balance
            const endCell = row.getCell(3);
            endCell.value = item.end;
            applyStyle(endCell, styles.numberCell);

            currentRow++;
        });

        const sectionEndRow = currentRow - 1;

        // Section total with FORMULAS
        if (section.items.length > 0) {
            const totalRow = worksheet.getRow(currentRow);

            totalRow.getCell(1).value = `Total ${section.name}`;
            applyStyle(totalRow.getCell(1), styles.totalRow);
            totalRow.getCell(1).alignment = { horizontal: 'left', vertical: 'center' };

            // Use SUM formula for beginning balance
            totalRow.getCell(2).value = { formula: `SUM(B${sectionStartRow}:B${sectionEndRow})` };
            applyStyle(totalRow.getCell(2), styles.totalRow);

            // Use SUM formula for ending balance
            totalRow.getCell(3).value = { formula: `SUM(C${sectionStartRow}:C${sectionEndRow})` };
            applyStyle(totalRow.getCell(3), styles.totalRow);

            // Track this total row for grand totals
            if (section.name.includes('ASSETS')) {
                assetSectionTotalRows.push(currentRow);
            } else {
                equityLiabSectionTotalRows.push(currentRow);
            }

            currentRow++;
        }

        // Empty row after section
        currentRow++;
    });

    // === GRAND TOTALS ===

    // TOTAL ASSETS
    if (assetSectionTotalRows.length > 0) {
        const totalAssetsRow = worksheet.getRow(currentRow);

        totalAssetsRow.getCell(1).value = 'TOTAL ASSETS';
        applyStyle(totalAssetsRow.getCell(1), styles.grandTotal);
        totalAssetsRow.getCell(1).alignment = { horizontal: 'left', vertical: 'center' };

        // Create formula that sums all asset section totals
        const assetRefs = assetSectionTotalRows.map(row => `B${row}`).join('+');
        totalAssetsRow.getCell(2).value = { formula: assetRefs };
        applyStyle(totalAssetsRow.getCell(2), styles.grandTotal);

        const assetRefsEnd = assetSectionTotalRows.map(row => `C${row}`).join('+');
        totalAssetsRow.getCell(3).value = { formula: assetRefsEnd };
        applyStyle(totalAssetsRow.getCell(3), styles.grandTotal);

        currentRow++;
    }

    // TOTAL EQUITY AND LIABILITIES
    if (equityLiabSectionTotalRows.length > 0) {
        const totalEquityRow = worksheet.getRow(currentRow);

        totalEquityRow.getCell(1).value = 'TOTAL EQUITY AND LIABILITIES';
        applyStyle(totalEquityRow.getCell(1), styles.grandTotal);
        totalEquityRow.getCell(1).alignment = { horizontal: 'left', vertical: 'center' };

        // Create formula that sums all equity/liability section totals
        const equityRefs = equityLiabSectionTotalRows.map(row => `B${row}`).join('+');
        totalEquityRow.getCell(2).value = { formula: equityRefs };
        applyStyle(totalEquityRow.getCell(2), styles.grandTotal);

        const equityRefsEnd = equityLiabSectionTotalRows.map(row => `C${row}`).join('+');
        totalEquityRow.getCell(3).value = { formula: equityRefsEnd };
        applyStyle(totalEquityRow.getCell(3), styles.grandTotal);

        currentRow++;
    }

    // === COLUMN WIDTHS ===
    // worksheet.getColumn(1).width = 15;  // IFRS Code
    worksheet.getColumn(1).width = 50;  // Line Item
    // worksheet.getColumn(3).width = 15;  // NSBU Code
    worksheet.getColumn(2).width = 20;  // Beginning Balance
    worksheet.getColumn(3).width = 20;  // Ending Balance

    return workbook;
}

/**
 * Create flat styled report (simple 3-column format)
 * @param {Object} data - Report data structure
 * @param {string} data.title - Report title
 * @param {string} data.subtitle - Report subtitle
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
async function styleReport(data, reportType) {
    switch (reportType) {
        case 'balanceSheet':
            return await createStyledBalanceSheet(data);

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
    formatDateToDDMMYYYY,
    STYLE_PRESETS
};