// utils/stylers/cashFlow.js - WITH ALTERNATING ROWS AND BRACKETED NEGATIVES

const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');
const {
    FONT_PRESETS,
    BRAND_COLORS,
    PRIMARY_FONT,
} = require('./fontConfig');

// Number format with brackets for negatives
const NUM_FMT_WITH_BRACKETS = '#,##0.00;(#,##0.00)';

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
    let dataRowCounter = 0; // Start at 0 so first row is white, second is blue, etc.

    // === LOGO ===
    try {
        let logoPath = '/app/public/assets/images/icons/logo-text-uc.png';
        if (fs.existsSync(logoPath)) {
            const imageId = workbook.addImage({
                filename: logoPath,
                extension: 'png'
            });

            worksheet.addImage(imageId, {
                tl: { col: 0, row: 0 },
                ext: { width: 188, height: 50 }
            });

            worksheet.getRow(1).height = 50;
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

        // Apply alternating color to year row
        const yearFill = (dataRowCounter % 2 === 0) ? null : {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: BRAND_COLORS.lightBlue }
        };
        yearRow.getCell(1).fill = yearFill;

        for (const group of yearGroups) {
            const startCol = group.startCol + 2;
            const endCol = group.endCol + 2;

            yearRow.getCell(startCol).value = group.year;
            yearRow.getCell(startCol).font = { name: PRIMARY_FONT, size: 11, bold: true };
            yearRow.getCell(startCol).alignment = { horizontal: 'center', vertical: 'center' };
            yearRow.getCell(startCol).fill = yearFill;

            if (startCol < endCol) {
                worksheet.mergeCells(currentRow, startCol, currentRow, endCol);
            }
        }

        yearRow.height = 20;
        currentRow++;
        dataRowCounter++; // Increment counter so next row alternates
    }

    // === PERIOD HEADER ROW ===
    const headerRow = worksheet.getRow(currentRow);
    headerRow.getCell(1).value = 'Cash Flow Activities';
    headerRow.getCell(1).font = { name: PRIMARY_FONT, size: 11, bold: true };
    headerRow.getCell(1).alignment = { horizontal: 'left', vertical: 'center', indent: 1 };

    // Apply alternating color to period header
    const headerFill = (dataRowCounter % 2 === 0) ? null : {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: BRAND_COLORS.lightBlue }
    };
    headerRow.getCell(1).fill = headerFill;

    for (let i = 0; i < periods.length; i++) {
        const cell = headerRow.getCell(i + 2);
        cell.value = periods[i].label;
        cell.font = { name: PRIMARY_FONT, size: 10, bold: true };
        cell.alignment = { horizontal: 'center', vertical: 'center' };
        cell.fill = headerFill;
    }

    headerRow.height = 22;
    currentRow++;
    dataRowCounter++; // Increment counter so next row alternates

    // === TRACK SECTION TOTAL ROWS FOR CF/FCF FORMULAS ===
    const sectionTotalRows = {
        operating: 0,
        investing: 0,
        financing: 0
    };

    // === CASH FLOW SECTIONS ===
    for (const section of data.sections) {
        // Check if this is a summary section (CF or FCF)
        if (section.isSummary) {
            const isCF = section.name === 'CF';
            const isFCF = section.name === 'FCF';
            
            if (isCF) {
                currentRow = addCalculatedSection(
                    worksheet,
                    currentRow,
                    'CF',
                    'Cash Flow (Operating + Investing + Financing)',
                    periods,
                    [sectionTotalRows.operating, sectionTotalRows.investing, sectionTotalRows.financing],
                    dataRowCounter
                );
                dataRowCounter += 2;
            } else if (isFCF) {
                currentRow = addCalculatedSection(
                    worksheet,
                    currentRow,
                    'FCF',
                    'Free Cash Flow (Operating + Investing)',
                    periods,
                    [sectionTotalRows.operating, sectionTotalRows.investing],
                    dataRowCounter
                );
                dataRowCounter += 2;
            }
            currentRow++;
            continue;
        }

        // Section header
        const sectionHeaderRow = worksheet.getRow(currentRow);
        sectionHeaderRow.getCell(1).value = `CASH FLOWS FROM ${section.name}:`;
        sectionHeaderRow.getCell(1).font = { name: PRIMARY_FONT, size: 11, bold: true };
        sectionHeaderRow.getCell(1).alignment = { horizontal: 'left', vertical: 'center', indent: 1 };
        
        // Alternating color for section header
        const sectionFill = (dataRowCounter % 2 === 0) ? null : {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: BRAND_COLORS.lightBlue }
        };
        
        sectionHeaderRow.getCell(1).fill = sectionFill;
        for (let i = 0; i < periods.length; i++) {
            sectionHeaderRow.getCell(i + 2).fill = sectionFill;
        }
        
        sectionHeaderRow.height = 20;
        currentRow++;
        dataRowCounter++;

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

            // Alternating fill for items
            const itemFill = (dataRowCounter % 2 === 0) ? null : {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: BRAND_COLORS.lightBlue }
            };

            itemRow.getCell(1).fill = itemFill;

            for (let i = 0; i < periods.length; i++) {
                const cell = itemRow.getCell(i + 2);
                const value = item.periodValues ? item.periodValues[i] : 0;

                if (!item.isCategory) {
                    cell.value = value;
                    cell.numFmt = NUM_FMT_WITH_BRACKETS;
                    cell.alignment = { horizontal: 'right', vertical: 'center' };
                    cell.fill = itemFill;
                }
            }

            currentRow++;
            dataRowCounter++;
        }

        const itemsEndRow = currentRow - 1;

        // Store range for this section
        if (section.name === 'OPERATING ACTIVITIES') {
            sectionTotalRows.operating = currentRow;
        } else if (section.name === 'INVESTING ACTIVITIES') {
            sectionTotalRows.investing = currentRow;
        } else if (section.name === 'FINANCING ACTIVITIES') {
            sectionTotalRows.financing = currentRow;
        }

        // Add section total with formulas
        let sectionTotal = null;
        if (section.name === 'OPERATING ACTIVITIES') {
            sectionTotal = data.operatingTotal;
        } else if (section.name === 'INVESTING ACTIVITIES') {
            sectionTotal = data.investingTotal;
        } else if (section.name === 'FINANCING ACTIVITIES') {
            sectionTotal = data.financingTotal;
        }

        if (sectionTotal) {
            currentRow = addSectionTotalWithFormulas(
                worksheet,
                currentRow,
                `Net cash from ${section.name.toLowerCase()}`,
                periods,
                { start: itemsStartRow, end: itemsEndRow },
                dataRowCounter
            );
            dataRowCounter++;
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
    
    const periodYears = [];
    let currentYear = null;
    
    for (let i = periods.length - 1; i >= 0; i--) {
        const period = periods[i];
        const yearMatch = period.label.match(/\b(20\d{2})\b/);
        
        if (yearMatch) {
            currentYear = yearMatch[1];
        }
        
        periodYears[i] = currentYear;
    }
    
    let i = 0;
    while (i < periods.length) {
        const year = periodYears[i];
        const startCol = i;
        
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

function addSectionTotalWithFormulas(worksheet, row, label, periods, range, dataRowCounter) {
    const totalRow = worksheet.getRow(row);

    totalRow.getCell(1).value = label;
    totalRow.getCell(1).font = { name: PRIMARY_FONT, size: 11, bold: true };
    totalRow.getCell(1).alignment = { horizontal: 'left', vertical: 'center', indent: 1 };
    
    const totalFill = (dataRowCounter % 2 === 0) ? null : {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: BRAND_COLORS.lightBlue }
    };
    
    totalRow.getCell(1).fill = totalFill;

    for (let i = 0; i < periods.length; i++) {
        const cell = totalRow.getCell(i + 2);
        const colLetter = getColumnLetter(i + 2);

        const formula = `=SUM(${colLetter}${range.start}:${colLetter}${range.end})`;
        cell.value = { formula: formula };
        cell.numFmt = NUM_FMT_WITH_BRACKETS;
        cell.font = { name: PRIMARY_FONT, size: 11, bold: true };
        cell.alignment = { horizontal: 'right', vertical: 'center' };
        cell.fill = totalFill;
        cell.border = {
            top: { style: 'thin' },
            bottom: { style: 'medium' }
        };
    }

    totalRow.height = 22;
    return row + 1;
}

function addCalculatedSection(worksheet, startRow, sectionName, label, periods, sourceRows, dataRowCounter) {
    let currentRow = startRow;

    // Header row
    const headerRow = worksheet.getRow(currentRow);
    headerRow.getCell(1).value = sectionName;
    headerRow.getCell(1).font = { name: PRIMARY_FONT, size: 12, bold: true };
    headerRow.getCell(1).alignment = { horizontal: 'left', vertical: 'center', indent: 1 };
    
    const headerFill = (dataRowCounter % 2 === 0) ? null : {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: BRAND_COLORS.lightBlue }
    };
    
    headerRow.getCell(1).fill = headerFill;

    for (let i = 0; i < periods.length; i++) {
        headerRow.getCell(i + 2).fill = headerFill;
    }
    headerRow.height = 22;
    currentRow++;

    // Value row with formula
    const valueRow = worksheet.getRow(currentRow);
    valueRow.getCell(1).value = label;
    valueRow.getCell(1).font = { name: PRIMARY_FONT, size: 11, bold: true };
    valueRow.getCell(1).alignment = { horizontal: 'left', vertical: 'center', indent: 1 };
    
    const valueFill = ((dataRowCounter + 1) % 2 === 0) ? null : {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: BRAND_COLORS.lightBlue }
    };
    
    valueRow.getCell(1).fill = valueFill;

    for (let i = 0; i < periods.length; i++) {
        const cell = valueRow.getCell(i + 2);
        const colLetter = getColumnLetter(i + 2);
        
        const rowRefs = sourceRows.map(r => `${colLetter}${r}`).join('+');
        const formula = `=${rowRefs}`;
        
        cell.value = { formula: formula };
        cell.numFmt = NUM_FMT_WITH_BRACKETS;
        cell.font = { name: PRIMARY_FONT, size: 11, bold: true };
        cell.alignment = { horizontal: 'right', vertical: 'center' };
        cell.fill = valueFill;
        cell.border = {
            top: { style: 'thin' },
            bottom: { style: 'double' }
        };
    }

    valueRow.height = 24;
    currentRow++;

    return currentRow;
}

module.exports = {
    styleCashFlowReport
};