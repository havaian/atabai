// utils/stylers/balanceSheet.js - UPDATED TO USE BLUE-ONLY COLOR SCHEME

const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');
const {
    FONT_PRESETS,
    BRAND_COLORS,
    ALIGNMENT_PRESETS,
    FILL_PRESETS,
    BORDER_PRESETS
} = require('./fontConfig');

/**
 * Universal Excel Styler Module
 * Handles all formatting and styling for IFRS reports
 * Now uses shared font configuration for consistency
 */

// Define style presets using shared font configuration
const STYLE_PRESETS = {
    // Professional IFRS balance sheet style
    balanceSheet: {
        title: {
            font: FONT_PRESETS.title,
            alignment: ALIGNMENT_PRESETS.center,
            fill: null
        },
        subtitle: {
            font: FONT_PRESETS.subtitle,
            alignment: ALIGNMENT_PRESETS.center,
            fill: null
        },
        metadata: {
            font: FONT_PRESETS.metadata,
            alignment: ALIGNMENT_PRESETS.center,
            fill: null
        },
        columnHeader: {
            font: FONT_PRESETS.columnHeader,
            alignment: { ...ALIGNMENT_PRESETS.center, wrapText: true },
            fill: {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: BRAND_COLORS.headerBlue }
            },
            border: BORDER_PRESETS.thin
        },
        sectionHeader: {
            font: FONT_PRESETS.sectionHeader,
            alignment: ALIGNMENT_PRESETS.left,
            fill: {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: BRAND_COLORS.sectionBlue }
            },
            border: BORDER_PRESETS.thin
        },
        dataCell: {
            font: FONT_PRESETS.normalData,
            alignment: ALIGNMENT_PRESETS.left,
            fill: null,
            border: BORDER_PRESETS.thin
        },
        numberCell: {
            font: FONT_PRESETS.normalData,
            alignment: ALIGNMENT_PRESETS.right,
            fill: null,
            border: BORDER_PRESETS.thin,
            numFmt: '#,##0.00;(#,##0.00)'
        },
        totalRow: {
            font: FONT_PRESETS.boldData,
            alignment: ALIGNMENT_PRESETS.right,
            fill: {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: BRAND_COLORS.lightBlue }
            },
            border: BORDER_PRESETS.thin,
            numFmt: '#,##0.00;(#,##0.00)'
        },
        grandTotal: {
            font: FONT_PRESETS.grandTotal,
            alignment: ALIGNMENT_PRESETS.right,
            fill: {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: BRAND_COLORS.lightBlue }
            },
            border: {
                top: { style: 'medium' },
                left: { style: 'thin' },
                bottom: { style: 'medium' },
                right: { style: 'thin' }
            },
            numFmt: '#,##0.00;(#,##0.00)'
        },
        watermark: {
            font: FONT_PRESETS.watermark,
            alignment: ALIGNMENT_PRESETS.right,
            fill: null
        }
    },

    // Simple flat report style (for depreciation, discounts, etc.)
    flatReport: {
        title: {
            font: { name: 'Calibri', size: 11, bold: false },
            alignment: ALIGNMENT_PRESETS.left,
            fill: null
        },
        columnHeader: {
            font: { name: 'Calibri', size: 11, bold: false },
            alignment: ALIGNMENT_PRESETS.left,
            fill: null,
            border: null
        },
        dataCell: {
            font: { name: 'Calibri', size: 11, bold: false },
            alignment: ALIGNMENT_PRESETS.left,
            fill: null,
            border: null
        },
        numberCell: {
            font: { name: 'Calibri', size: 11, bold: false },
            alignment: ALIGNMENT_PRESETS.right,
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
        let logoPath = '/app/public/assets/images/icons/logo-text-uc.png';

        if (fs.existsSync(logoPath)) {
            const imageId = workbook.addImage({
                filename: logoPath,
                extension: 'png',
            });

            worksheet.addImage(imageId, {
                tl: { col: 0, row: 0 },
                ext: { width: 150, height: 50 }
            });

            worksheet.getRow(1).height = 30;
            currentRow += 2;
        } else {
            global.logger.logWarn('[BALANCE SHEET STYLER] Logo not found');
            currentRow += 2;
        }
    } catch (error) {
        global.logger.logWarn('[BALANCE SHEET STYLER] Could not load logo:', error.message);
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

    // Track data row counter for alternating colors
    let dataRowCounter = 0;

    // === DATA SECTIONS ===
    data.sections.forEach(section => {
        // Section header
        worksheet.mergeCells(`A${currentRow}:C${currentRow}`);
        const sectionCell = worksheet.getCell(`A${currentRow}`);
        sectionCell.value = section.name;
        sectionCell.font = FONT_PRESETS.sectionHeader;
        sectionCell.alignment = ALIGNMENT_PRESETS.left;
        sectionCell.border = BORDER_PRESETS.thin;

        // Alternating fill for section header
        const sectionFill = (dataRowCounter % 2 === 0) ? null : {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: BRAND_COLORS.lightBlue }
        };
        sectionCell.fill = sectionFill;
        currentRow++;
        dataRowCounter++;

        // Track first and last data row for this section
        const sectionStartRow = currentRow;

        // Section items
        section.items.forEach(item => {
            const row = worksheet.getRow(currentRow);

            // Alternating fill for data rows
            const rowFill = (dataRowCounter % 2 === 0) ? null : {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: BRAND_COLORS.lightBlue }
            };

            // Line Item
            const labelCell = row.getCell(1);
            labelCell.value = item.label;
            labelCell.font = FONT_PRESETS.normalData;
            labelCell.alignment = ALIGNMENT_PRESETS.left;
            labelCell.border = BORDER_PRESETS.thin;
            labelCell.fill = rowFill;

            // Beginning Balance
            const startCell = row.getCell(2);
            startCell.value = item.start;
            startCell.font = FONT_PRESETS.normalData;
            startCell.alignment = ALIGNMENT_PRESETS.right;
            startCell.border = BORDER_PRESETS.thin;
            startCell.numFmt = '#,##0.00;(#,##0.00)';
            startCell.fill = rowFill;

            // Ending Balance
            const endCell = row.getCell(3);
            endCell.value = item.end;
            endCell.font = FONT_PRESETS.normalData;
            endCell.alignment = ALIGNMENT_PRESETS.right;
            endCell.border = BORDER_PRESETS.thin;
            endCell.numFmt = '#,##0.00;(#,##0.00)';
            endCell.fill = rowFill;

            currentRow++;
            dataRowCounter++;
        });

        const sectionEndRow = currentRow - 1;

        // Section total with FORMULAS
        if (section.items.length > 0) {
            const totalRow = worksheet.getRow(currentRow);

            // Alternating fill for total row
            const totalFill = (dataRowCounter % 2 === 0) ? null : {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: BRAND_COLORS.lightBlue }
            };

            totalRow.getCell(1).value = `Total ${section.name}`;
            totalRow.getCell(1).font = FONT_PRESETS.boldData;
            totalRow.getCell(1).alignment = ALIGNMENT_PRESETS.left;
            totalRow.getCell(1).border = BORDER_PRESETS.thin;
            totalRow.getCell(1).fill = totalFill;

            // Use SUM formula for beginning balance
            totalRow.getCell(2).value = { formula: `SUM(B${sectionStartRow}:B${sectionEndRow})` };
            totalRow.getCell(2).font = FONT_PRESETS.boldData;
            totalRow.getCell(2).alignment = ALIGNMENT_PRESETS.right;
            totalRow.getCell(2).border = BORDER_PRESETS.thin;
            totalRow.getCell(2).numFmt = '#,##0.00;(#,##0.00)';
            totalRow.getCell(2).fill = totalFill;

            // Use SUM formula for ending balance
            totalRow.getCell(3).value = { formula: `SUM(C${sectionStartRow}:C${sectionEndRow})` };
            totalRow.getCell(3).font = FONT_PRESETS.boldData;
            totalRow.getCell(3).alignment = ALIGNMENT_PRESETS.right;
            totalRow.getCell(3).border = BORDER_PRESETS.thin;
            totalRow.getCell(3).numFmt = '#,##0.00;(#,##0.00)';
            totalRow.getCell(3).fill = totalFill;

            // Track this total row for grand totals
            if (section.name.includes('ASSETS')) {
                assetSectionTotalRows.push(currentRow);
            } else {
                equityLiabSectionTotalRows.push(currentRow);
            }

            currentRow++;
            dataRowCounter++;
        }

        // Empty row after section
        currentRow++;
    });

    // === GRAND TOTALS ===

    // TOTAL ASSETS
    if (assetSectionTotalRows.length > 0) {
        const totalAssetsRow = worksheet.getRow(currentRow);

        const assetsFill = (dataRowCounter % 2 === 0) ? null : {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: BRAND_COLORS.lightBlue }
        };

        totalAssetsRow.getCell(1).value = 'TOTAL ASSETS';
        totalAssetsRow.getCell(1).font = FONT_PRESETS.grandTotal;
        totalAssetsRow.getCell(1).alignment = ALIGNMENT_PRESETS.left;
        totalAssetsRow.getCell(1).border = {
            top: { style: 'medium' },
            left: { style: 'thin' },
            bottom: { style: 'medium' },
            right: { style: 'thin' }
        };
        totalAssetsRow.getCell(1).fill = assetsFill;

        // Create formula that sums all asset section totals
        const assetRefs = assetSectionTotalRows.map(row => `B${row}`).join('+');
        totalAssetsRow.getCell(2).value = { formula: assetRefs };
        totalAssetsRow.getCell(2).font = FONT_PRESETS.grandTotal;
        totalAssetsRow.getCell(2).alignment = ALIGNMENT_PRESETS.right;
        totalAssetsRow.getCell(2).border = {
            top: { style: 'medium' },
            left: { style: 'thin' },
            bottom: { style: 'medium' },
            right: { style: 'thin' }
        };
        totalAssetsRow.getCell(2).numFmt = '#,##0.00;(#,##0.00)';
        totalAssetsRow.getCell(2).fill = assetsFill;

        const assetRefsEnd = assetSectionTotalRows.map(row => `C${row}`).join('+');
        totalAssetsRow.getCell(3).value = { formula: assetRefsEnd };
        totalAssetsRow.getCell(3).font = FONT_PRESETS.grandTotal;
        totalAssetsRow.getCell(3).alignment = ALIGNMENT_PRESETS.right;
        totalAssetsRow.getCell(3).border = {
            top: { style: 'medium' },
            left: { style: 'thin' },
            bottom: { style: 'medium' },
            right: { style: 'thin' }
        };
        totalAssetsRow.getCell(3).numFmt = '#,##0.00;(#,##0.00)';
        totalAssetsRow.getCell(3).fill = assetsFill;

        currentRow++;
        dataRowCounter++;
    }

    // TOTAL EQUITY AND LIABILITIES
    if (equityLiabSectionTotalRows.length > 0) {
        const totalEquityRow = worksheet.getRow(currentRow);

        const equityFill = (dataRowCounter % 2 === 0) ? null : {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: BRAND_COLORS.lightBlue }
        };

        totalEquityRow.getCell(1).value = 'TOTAL EQUITY AND LIABILITIES';
        totalEquityRow.getCell(1).font = FONT_PRESETS.grandTotal;
        totalEquityRow.getCell(1).alignment = ALIGNMENT_PRESETS.left;
        totalEquityRow.getCell(1).border = {
            top: { style: 'medium' },
            left: { style: 'thin' },
            bottom: { style: 'medium' },
            right: { style: 'thin' }
        };
        totalEquityRow.getCell(1).fill = equityFill;

        // Create formula that sums all equity/liability section totals
        const equityRefs = equityLiabSectionTotalRows.map(row => `B${row}`).join('+');
        totalEquityRow.getCell(2).value = { formula: equityRefs };
        totalEquityRow.getCell(2).font = FONT_PRESETS.grandTotal;
        totalEquityRow.getCell(2).alignment = ALIGNMENT_PRESETS.right;
        totalEquityRow.getCell(2).border = {
            top: { style: 'medium' },
            left: { style: 'thin' },
            bottom: { style: 'medium' },
            right: { style: 'thin' }
        };
        totalEquityRow.getCell(2).numFmt = '#,##0.00;(#,##0.00)';
        totalEquityRow.getCell(2).fill = equityFill;

        const equityRefsEnd = equityLiabSectionTotalRows.map(row => `C${row}`).join('+');
        totalEquityRow.getCell(3).value = { formula: equityRefsEnd };
        totalEquityRow.getCell(3).font = FONT_PRESETS.grandTotal;
        totalEquityRow.getCell(3).alignment = ALIGNMENT_PRESETS.right;
        totalEquityRow.getCell(3).border = {
            top: { style: 'medium' },
            left: { style: 'thin' },
            bottom: { style: 'medium' },
            right: { style: 'thin' }
        };
        totalEquityRow.getCell(3).numFmt = '#,##0.00;(#,##0.00)';
        totalEquityRow.getCell(3).fill = equityFill;

        currentRow++;
    }

    // === ATABAI WATERMARK ===
    currentRow += 2;
    const watermarkRow = worksheet.getRow(currentRow);
    watermarkRow.getCell(1).value = 'Processed by ATABAI';
    applyStyle(watermarkRow.getCell(1), styles.watermark);
    worksheet.mergeCells(currentRow, 1, currentRow, 3);

    // === COLUMN WIDTHS ===
    worksheet.getColumn(1).width = 50;  // Line Item
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

                // Apply number formatting to numeric columns (except first column)
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