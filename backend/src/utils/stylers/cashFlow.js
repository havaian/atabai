// utils/stylers/cashFlow.js

const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');
const {
    FONT_PRESETS,
    BRAND_COLORS,
    PRIMARY_FONT,
} = require('./fontConfig');

async function styleCashFlowReport(data) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Cash Flow Statement');

    const periods = data.periods || [];
    const periodCount = periods.length;

    // === COLUMN WIDTHS ===
    worksheet.getColumn(1).width = 50;
    for (let i = 0; i < periodCount; i++) {
        worksheet.getColumn(i + 2).width = 18;
    }

    let currentRow = 1;

    // === LOGO ===
    try {
        let logoPath = path.join(__dirname, '../../../public/assets/images/icons/logo-text-uc.png');
        if (fs.existsSync(logoPath)) {
            const imageId = workbook.addImage({
                filename: logoPath,
                extension: 'png'
            });

            worksheet.addImage(imageId, {
                tl: { col: 0, row: 0 },
                ext: { width: 150, height: 40 }
            });

            worksheet.getRow(1).height = 30;
            currentRow += 2;
        } else {
            currentRow += 1;
        }
    } catch (error) {
        global.logger.logWarn('[CF STYLER] Could not load logo:', error.message);
        currentRow += 1;
    }

    // === TITLE ===
    const titleRow = worksheet.getRow(currentRow);
    titleRow.getCell(1).value = 'STATEMENT OF CASH FLOWS (IFRS)';
    titleRow.getCell(1).font = { name: PRIMARY_FONT, size: 14, bold: true, color: { argb: BRAND_COLORS.black } };
    titleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'center' };
    worksheet.mergeCells(currentRow, 1, currentRow, periodCount + 1);
    currentRow++;

    if (data.companyName) {
        const nameRow = worksheet.getRow(currentRow);
        nameRow.getCell(1).value = data.companyName;
        nameRow.getCell(1).font = { name: PRIMARY_FONT, size: 12, bold: true };
        nameRow.getCell(1).alignment = { horizontal: 'center' };
        worksheet.mergeCells(currentRow, 1, currentRow, periodCount + 1);
        currentRow++;
    }

    if (data.period) {
        const periodRow = worksheet.getRow(currentRow);
        periodRow.getCell(1).value = data.period;
        periodRow.getCell(1).font = { name: PRIMARY_FONT, size: 10 };
        periodRow.getCell(1).alignment = { horizontal: 'center' };
        worksheet.mergeCells(currentRow, 1, currentRow, periodCount + 1);
        currentRow++;
    }

    currentRow++;

    // === YEAR ROW ===
    const yearGroups = groupPeriodsByYear(periods);

    if (yearGroups.length > 1) {
        const yearRow = worksheet.getRow(currentRow);
        yearRow.getCell(1).value = '';

        for (const group of yearGroups) {
            const startCol = group.startCol + 2;
            const endCol = group.endCol + 2;

            yearRow.getCell(startCol).value = group.year;
            yearRow.getCell(startCol).font = { name: PRIMARY_FONT, size: 11, bold: true, color: { argb: BRAND_COLORS.white } };
            yearRow.getCell(startCol).alignment = { horizontal: 'center', vertical: 'center' };
            yearRow.getCell(startCol).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: BRAND_COLORS.headerBlue }
            };

            if (startCol < endCol) {
                worksheet.mergeCells(currentRow, startCol, currentRow, endCol);
                for (let col = startCol + 1; col <= endCol; col++) {
                    yearRow.getCell(col).fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: BRAND_COLORS.headerBlue }
                    };
                }
            }
        }

        yearRow.height = 20;
        currentRow++;
    }

    // === PERIOD HEADER ROW ===
    const headerRow = worksheet.getRow(currentRow);
    headerRow.getCell(1).value = 'Cash Flow Activities';
    headerRow.getCell(1).font = { name: PRIMARY_FONT, size: 11, bold: true, color: { argb: BRAND_COLORS.white } };
    headerRow.getCell(1).alignment = { horizontal: 'left', vertical: 'center', indent: 1 };
    headerRow.getCell(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: BRAND_COLORS.headerBlue }
    };

    for (let i = 0; i < periods.length; i++) {
        const cell = headerRow.getCell(i + 2);
        cell.value = periods[i].label;
        cell.font = { name: PRIMARY_FONT, size: 10, bold: true, color: { argb: BRAND_COLORS.white } };
        cell.alignment = { horizontal: 'center', vertical: 'center' };
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: BRAND_COLORS.headerBlue }
        };
    }

    headerRow.height = 22;
    currentRow++;

    // === TRACK SECTION RANGES FOR FORMULAS ===
    const sectionRanges = {
        operating: { start: 0, end: 0 },
        investing: { start: 0, end: 0 },
        financing: { start: 0, end: 0 },
        additionalSources: { start: 0, end: 0 }
    };

    // === CASH FLOW SECTIONS ===
    for (const section of data.sections) {
        // Check if this is a summary section (CF or FCF)
        if (section.isSummary) {
            currentRow = addSummarySection(
                worksheet,
                currentRow,
                section.name,
                section.items[0].label,
                periods,
                section.items[0].periodValues
            );
            currentRow++;
            continue;
        }

        const sectionStartRow = currentRow;

        const sectionHeaderRow = worksheet.getRow(currentRow);
        sectionHeaderRow.getCell(1).value = `CASH FLOWS FROM ${section.name}:`;
        sectionHeaderRow.getCell(1).font = { name: PRIMARY_FONT, size: 11, bold: true, color: { argb: BRAND_COLORS.white } };
        sectionHeaderRow.getCell(1).alignment = { horizontal: 'left', vertical: 'center', indent: 1 };
        sectionHeaderRow.getCell(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: BRAND_COLORS.sectionBlue }
        };

        for (let i = 0; i < periods.length; i++) {
            sectionHeaderRow.getCell(i + 2).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: BRAND_COLORS.sectionBlue }
            };
        }
        sectionHeaderRow.height = 20;
        currentRow++;

        const itemsStartRow = currentRow;

        for (const item of section.items) {
            const itemRow = worksheet.getRow(currentRow);

            itemRow.getCell(1).value = item.label;
            itemRow.getCell(1).font = { name: PRIMARY_FONT, size: 10 };
            itemRow.getCell(1).alignment = {
                horizontal: 'left',
                vertical: 'center',
                indent: item.isCategory ? 1 : (item.indent || 1)
            };

            if (item.isCategory) {
                itemRow.getCell(1).font = { name: PRIMARY_FONT, size: 10, bold: true };
            }

            for (let i = 0; i < periods.length; i++) {
                const cell = itemRow.getCell(i + 2);
                const value = item.periodValues ? item.periodValues[i] : 0;

                // Don't show values for category headers
                if (!item.isCategory) {
                    cell.value = value;
                    cell.numFmt = '#,##0.00';
                    cell.alignment = { horizontal: 'right', vertical: 'center' };

                    if (value < 0) {
                        cell.font = { name: PRIMARY_FONT, size: 10, color: { argb: BRAND_COLORS.red } };
                    }
                }
            }

            currentRow++;
        }

        const itemsEndRow = currentRow - 1;

        // Store range
        if (section.name === 'OPERATING ACTIVITIES') {
            sectionRanges.operating.start = itemsStartRow;
            sectionRanges.operating.end = itemsEndRow;
        } else if (section.name === 'INVESTING ACTIVITIES') {
            sectionRanges.investing.start = itemsStartRow;
            sectionRanges.investing.end = itemsEndRow;
        } else if (section.name === 'FINANCING ACTIVITIES') {
            sectionRanges.financing.start = itemsStartRow;
            sectionRanges.financing.end = itemsEndRow;
        } else if (section.name === 'ADDITIONAL SOURCES') {
            sectionRanges.additionalSources.start = itemsStartRow;
            sectionRanges.additionalSources.end = itemsEndRow;
        }

        // Add section total with formulas
        let sectionTotal = null;
        if (section.name === 'OPERATING ACTIVITIES') {
            sectionTotal = data.operatingTotal;
        } else if (section.name === 'INVESTING ACTIVITIES') {
            sectionTotal = data.investingTotal;
        } else if (section.name === 'FINANCING ACTIVITIES') {
            sectionTotal = data.financingTotal;
        } else if (section.name === 'ADDITIONAL SOURCES') {
            sectionTotal = data.additionalSourcesTotal;
        }

        if (sectionTotal) {
            currentRow = addSectionTotalWithFormulas(
                worksheet,
                currentRow,
                `Net cash from ${section.name.toLowerCase()}`,
                periods,
                { start: itemsStartRow, end: itemsEndRow }
            );
        }

        currentRow++;
    }

    // === ATABAI WATERMARK ===
    currentRow += 2;
    const watermarkRow = worksheet.getRow(currentRow);
    watermarkRow.getCell(1).value = 'Processed by ATABAI';
    watermarkRow.getCell(1).font = {
        name: PRIMARY_FONT,
        size: 9,
        italic: true,
        color: { argb: BRAND_COLORS.primary }
    };
    watermarkRow.getCell(1).alignment = { horizontal: 'right' };
    worksheet.mergeCells(currentRow, 1, currentRow, periodCount + 1);

    return workbook;
}

function groupPeriodsByYear(periods) {
    const groups = [];
    
    // First, assign years to each period by working backwards from summary columns
    const periodYears = [];
    let currentYear = null;
    
    // Scan backwards so that when we find "Итого 2024", we can assign 2024 to preceding months
    for (let i = periods.length - 1; i >= 0; i--) {
        const period = periods[i];
        const yearMatch = period.label.match(/\b(20\d{2})\b/);
        
        if (yearMatch) {
            // Found a year (in "Итого 2024" or similar)
            currentYear = yearMatch[1];
        }
        
        periodYears[i] = currentYear;
    }
    
    // Now group consecutive periods with the same year (forward pass)
    let i = 0;
    while (i < periods.length) {
        const year = periodYears[i];
        const startCol = i;
        
        // Find end of this year group
        while (i < periods.length && periodYears[i] === year) {
            i++;
        }
        
        groups.push({
            year: year || 'Unknown',
            startCol: startCol,
            endCol: i - 1
        });
    }
    
    return groups;
}

function getColumnLetter(col) {
    let letter = '';
    while (col > 0) {
        const remainder = (col - 1) % 26;
        letter = String.fromCharCode(65 + remainder) + letter;
        col = Math.floor((col - 1) / 26);
    }
    return letter;
}

function addSectionTotalWithFormulas(worksheet, row, label, periods, range) {
    const totalRow = worksheet.getRow(row);

    totalRow.getCell(1).value = label;
    totalRow.getCell(1).font = { name: PRIMARY_FONT, size: 11, bold: true };
    totalRow.getCell(1).alignment = { horizontal: 'left', vertical: 'center', indent: 1 };
    totalRow.getCell(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: BRAND_COLORS.lightBlue }
    };

    for (let i = 0; i < periods.length; i++) {
        const cell = totalRow.getCell(i + 2);
        const colLetter = getColumnLetter(i + 2);

        const formula = `=SUM(${colLetter}${range.start}:${colLetter}${range.end})`;
        cell.value = { formula: formula };
        cell.numFmt = '#,##0.00';
        cell.font = { name: PRIMARY_FONT, size: 11, bold: true };
        cell.alignment = { horizontal: 'right', vertical: 'center' };
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: BRAND_COLORS.lightBlue }
        };
        cell.border = {
            top: { style: 'thin' },
            bottom: { style: 'medium' }
        };
    }

    totalRow.height = 22;
    return row + 1;
}

function addSummarySection(worksheet, startRow, sectionName, label, periods, periodValues) {
    let currentRow = startRow;

    // Header row with special color for CF/FCF
    const headerRow = worksheet.getRow(currentRow);
    headerRow.getCell(1).value = sectionName;
    headerRow.getCell(1).font = { name: PRIMARY_FONT, size: 12, bold: true, color: { argb: BRAND_COLORS.white } };
    headerRow.getCell(1).alignment = { horizontal: 'left', vertical: 'center', indent: 1 };
    
    const headerColor = sectionName === 'FCF' ? BRAND_COLORS.green : BRAND_COLORS.primary;
    headerRow.getCell(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: headerColor }
    };

    for (let i = 0; i < periods.length; i++) {
        headerRow.getCell(i + 2).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: headerColor }
        };
    }
    headerRow.height = 22;
    currentRow++;

    // Value row
    const valueRow = worksheet.getRow(currentRow);
    valueRow.getCell(1).value = label;
    valueRow.getCell(1).font = { name: PRIMARY_FONT, size: 11, bold: true };
    valueRow.getCell(1).alignment = { horizontal: 'left', vertical: 'center', indent: 1 };

    const bgColor = sectionName === 'FCF' ? BRAND_COLORS.lightGreen : BRAND_COLORS.lightBlue;
    valueRow.getCell(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: bgColor }
    };

    for (let i = 0; i < periods.length; i++) {
        const cell = valueRow.getCell(i + 2);
        cell.value = periodValues[i];
        cell.numFmt = '#,##0.00';
        cell.font = { name: PRIMARY_FONT, size: 11, bold: true };
        cell.alignment = { horizontal: 'right', vertical: 'center' };
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: bgColor }
        };
        cell.border = {
            top: { style: 'thin' },
            bottom: { style: 'double' }
        };

        if (periodValues[i] < 0) {
            cell.font = { name: PRIMARY_FONT, size: 11, bold: true, color: { argb: BRAND_COLORS.red } };
        }
    }

    valueRow.height = 24;
    currentRow++;

    return currentRow;
}

module.exports = {
    styleCashFlowReport
};