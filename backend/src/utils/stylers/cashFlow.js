// utils/stylers/cashFlow.js - FIX YEAR GROUPING

const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

async function styleCashFlowReport(data) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Cash Flow Statement');

    const periods = data.periods || [{ label: 'Total', columnIndex: 1 }];
    const periodCount = periods.length;

    global.logger.logInfo(`[CF STYLER] Creating output with ${periodCount} period columns`);

    const columns = [{ width: 50 }];
    for (let i = 0; i < periodCount; i++) {
        columns.push({ width: 15 });
    }
    worksheet.columns = columns;

    let currentRow = 1;

    // === LOGO ===
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
    titleRow.getCell(1).font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FF1F4E78' } };
    titleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'center' };
    worksheet.mergeCells(currentRow, 1, currentRow, periodCount + 1);
    currentRow++;

    if (data.companyName) {
        const nameRow = worksheet.getRow(currentRow);
        nameRow.getCell(1).value = data.companyName;
        nameRow.getCell(1).font = { name: 'Arial', size: 12, bold: true };
        nameRow.getCell(1).alignment = { horizontal: 'center' };
        worksheet.mergeCells(currentRow, 1, currentRow, periodCount + 1);
        currentRow++;
    }

    if (data.period) {
        const periodRow = worksheet.getRow(currentRow);
        periodRow.getCell(1).value = data.period;
        periodRow.getCell(1).font = { name: 'Arial', size: 10 };
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
            const startCol = group.startCol + 2;  // +2: column 1 is description, periods start at column 2
            const endCol = group.endCol + 2;

            yearRow.getCell(startCol).value = group.year;
            yearRow.getCell(startCol).font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
            yearRow.getCell(startCol).alignment = { horizontal: 'center', vertical: 'center' };
            yearRow.getCell(startCol).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF4472C4' }
            };

            if (startCol < endCol) {
                worksheet.mergeCells(currentRow, startCol, currentRow, endCol);
            }

            for (let col = startCol; col <= endCol; col++) {
                yearRow.getCell(col).fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FF4472C4' }
                };
                yearRow.getCell(col).border = {
                    top: { style: 'thin', color: { argb: 'FFFFFFFF' } },
                    left: { style: 'thin', color: { argb: 'FFFFFFFF' } },
                    bottom: { style: 'thin', color: { argb: 'FFFFFFFF' } },
                    right: { style: 'thin', color: { argb: 'FFFFFFFF' } }
                };
            }
        }

        yearRow.height = 22;
        currentRow++;
    }

    // === MONTH/PERIOD ROW ===
    const headerRow = worksheet.getRow(currentRow);
    headerRow.getCell(1).value = 'Cash Flow Statement';
    headerRow.getCell(1).font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.getCell(1).alignment = { horizontal: 'left', vertical: 'center' };
    headerRow.getCell(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1F4E78' }
    };

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

    const sectionRanges = {
        operating: { start: 0, end: 0 },
        investing: { start: 0, end: 0 },
        financing: { start: 0, end: 0 }
    };

    // === OPERATING ===
    sectionRanges.operating.start = currentRow + 1;
    currentRow = addSection(worksheet, currentRow, 'CASH FLOWS FROM OPERATING ACTIVITIES:', periods, data.sections[0], true);
    sectionRanges.operating.end = currentRow - 1;
    currentRow = addSectionTotalWithFormulas(worksheet, currentRow, 'Net cash from operating activities', periods, sectionRanges.operating);
    currentRow++;

    // === INVESTING ===
    sectionRanges.investing.start = currentRow + 1;
    currentRow = addSection(worksheet, currentRow, 'CASH FLOWS FROM INVESTING ACTIVITIES:', periods, data.sections[1], false);
    sectionRanges.investing.end = currentRow - 1;
    currentRow = addSectionTotalWithFormulas(worksheet, currentRow, 'Net cash from investing activities', periods, sectionRanges.investing);
    currentRow++;

    // === FINANCING ===
    sectionRanges.financing.start = currentRow + 1;
    currentRow = addSection(worksheet, currentRow, 'CASH FLOWS FROM FINANCING ACTIVITIES:', periods, data.sections[2], false);
    sectionRanges.financing.end = currentRow - 1;
    currentRow = addSectionTotalWithFormulas(worksheet, currentRow, 'Net cash from financing activities', periods, sectionRanges.financing);
    currentRow++;

    // === RECONCILIATION ===
    if (data.reconciliation && data.reconciliation.length > 0) {
        currentRow = addReconciliationSection(worksheet, currentRow, periods, data.reconciliation);
    }

    // === FINAL RECONCILIATION ===
    currentRow = addFinalReconciliation(worksheet, currentRow, periods, data, sectionRanges);

    return workbook;
}

/**
 * Group periods by year - FIXED LOGIC
 * Strategy: Look forward to find year, apply it backward to all months
 */
function groupPeriodsByYear(periods) {
    // Step 1: Extract years from all periods
    const years = periods.map(p => extractYear(p.label));

    // Step 2: Fill nulls by looking FORWARD and applying year backward
    for (let i = 0; i < years.length; i++) {
        if (!years[i]) {
            // Look forward for next year
            let foundYear = null;
            for (let j = i + 1; j < years.length; j++) {
                if (years[j]) {
                    foundYear = years[j];
                    break;
                }
            }

            // Apply found year (or keep null if no year found ahead)
            if (foundYear) {
                years[i] = foundYear;
            }
        }
    }

    // Step 3: Group consecutive periods with same year
    const groups = [];
    let currentYear = null;
    let currentGroup = null;

    for (let i = 0; i < years.length; i++) {
        if (years[i] !== currentYear) {
            // Year changed - start new group
            if (currentGroup) {
                groups.push(currentGroup);
            }
            currentYear = years[i];
            currentGroup = {
                year: currentYear || 'Total',
                startCol: i,
                endCol: i
            };
        } else {
            // Same year - extend current group
            if (currentGroup) {
                currentGroup.endCol = i;
            }
        }
    }

    // Add last group
    if (currentGroup) {
        groups.push(currentGroup);
    }

    return groups;
}

/**
 * Extract year from period label
 */
function extractYear(label) {
    if (!label) return null;

    const str = String(label);
    const match = str.match(/20\d{2}/);

    return match ? match[0] : null;
}

function addSection(worksheet, startRow, sectionTitle, periods, sectionData, isOperating) {
    let currentRow = startRow;

    const headerRow = worksheet.getRow(currentRow);
    headerRow.getCell(1).value = sectionTitle;
    headerRow.getCell(1).font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.getCell(1).alignment = { horizontal: 'left', vertical: 'center', indent: 1 };
    headerRow.getCell(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1F4E78' }
    };

    for (let i = 0; i < periods.length; i++) {
        headerRow.getCell(i + 2).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF1F4E78' }
        };
    }
    headerRow.height = 20;
    currentRow++;

    if (sectionData && sectionData.items) {
        for (const item of sectionData.items) {
            const itemRow = worksheet.getRow(currentRow);

            itemRow.getCell(1).value = item.label;
            itemRow.getCell(1).font = { name: 'Arial', size: 10 };
            itemRow.getCell(1).alignment = { horizontal: 'left', vertical: 'center', indent: item.indent || 1 };

            for (let i = 0; i < periods.length; i++) {
                const cell = itemRow.getCell(i + 2);
                const value = item.periodValues ? item.periodValues[i] : 0;
                cell.value = value;
                cell.numFmt = '#,##0.00';
                cell.alignment = { horizontal: 'right', vertical: 'center' };

                if (value < 0) {
                    cell.font = { name: 'Arial', size: 10, color: { argb: 'FFCC0000' } };
                }
            }

            currentRow++;
        }
    }

    return currentRow;
}

function addSectionTotalWithFormulas(worksheet, row, label, periods, range) {
    const totalRow = worksheet.getRow(row);

    totalRow.getCell(1).value = label;
    totalRow.getCell(1).font = { name: 'Arial', size: 11, bold: true };
    totalRow.getCell(1).alignment = { horizontal: 'left', vertical: 'center', indent: 1 };
    totalRow.getCell(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD9E1F2' }
    };

    for (let i = 0; i < periods.length; i++) {
        const cell = totalRow.getCell(i + 2);
        const colLetter = getColumnLetter(i + 2);

        const formula = `=SUM(${colLetter}${range.start}:${colLetter}${range.end})`;
        cell.value = { formula: formula };
        cell.numFmt = '#,##0.00';
        cell.font = { name: 'Arial', size: 11, bold: true };
        cell.alignment = { horizontal: 'right', vertical: 'center' };
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFD9E1F2' }
        };
        cell.border = {
            top: { style: 'thin' },
            bottom: { style: 'medium' }
        };
    }

    totalRow.height = 22;
    return row + 1;
}

function addReconciliationSection(worksheet, startRow, periods, reconciliationItems) {
    let currentRow = startRow;

    const headerRow = worksheet.getRow(currentRow);
    headerRow.getCell(1).value = 'RECONCILIATION TO FREE CASH FLOW:';
    headerRow.getCell(1).font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.getCell(1).alignment = { horizontal: 'left', vertical: 'center', indent: 1 };
    headerRow.getCell(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF70AD47' }
    };

    for (let i = 0; i < periods.length; i++) {
        headerRow.getCell(i + 2).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF70AD47' }
        };
    }
    headerRow.height = 20;
    currentRow++;

    for (const item of reconciliationItems) {
        const itemRow = worksheet.getRow(currentRow);

        itemRow.getCell(1).value = item.label;
        itemRow.getCell(1).font = { name: 'Arial', size: 10, bold: item.type === 'FCF' };
        itemRow.getCell(1).alignment = { horizontal: 'left', vertical: 'center', indent: item.type === 'FCF' ? 1 : 2 };

        for (let i = 0; i < periods.length; i++) {
            const cell = itemRow.getCell(i + 2);
            const value = item.periodValues[i];
            cell.value = value;
            cell.numFmt = '#,##0.00';
            cell.alignment = { horizontal: 'right', vertical: 'center' };

            if (item.type === 'FCF') {
                cell.font = { name: 'Arial', size: 10, bold: true };
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFE2EFDA' }
                };
            } else if (value < 0) {
                cell.font = { name: 'Arial', size: 10, color: { argb: 'FFCC0000' } };
            }
        }

        currentRow++;
    }

    currentRow++;
    return currentRow;
}

function addFinalReconciliation(worksheet, startRow, periods, data, sectionRanges) {
    let currentRow = startRow;

    const operatingTotalRow = sectionRanges.operating.end + 1;
    const investingTotalRow = sectionRanges.investing.end + 1;
    const financingTotalRow = sectionRanges.financing.end + 1;

    const netRow = worksheet.getRow(currentRow);
    netRow.getCell(1).value = 'Net increase/(decrease) in cash and cash equivalents';
    netRow.getCell(1).font = { name: 'Arial', size: 11, bold: true };
    netRow.getCell(1).alignment = { horizontal: 'left', vertical: 'center', indent: 1 };
    netRow.getCell(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFCE4D6' }
    };

    for (let i = 0; i < periods.length; i++) {
        const cell = netRow.getCell(i + 2);
        const colLetter = getColumnLetter(i + 2);

        const formula = `=${colLetter}${operatingTotalRow}+${colLetter}${investingTotalRow}+${colLetter}${financingTotalRow}`;
        cell.value = { formula: formula };
        cell.numFmt = '#,##0.00';
        cell.font = { name: 'Arial', size: 11, bold: true };
        cell.alignment = { horizontal: 'right', vertical: 'center' };
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFCE4D6' }
        };
        cell.border = {
            top: { style: 'medium' },
            bottom: { style: 'thin' }
        };
    }
    netRow.height = 22;
    const netChangeRow = currentRow;
    currentRow++;

    let fxEffectsRow = null;
    const hasFxEffects = data.fxEffects && data.fxEffects.some(v => Math.abs(v) > 0.01);
    if (hasFxEffects) {
        fxEffectsRow = currentRow;
        const fxRow = worksheet.getRow(currentRow);
        fxRow.getCell(1).value = 'Effect of exchange rate changes';
        fxRow.getCell(1).font = { name: 'Arial', size: 10 };
        fxRow.getCell(1).alignment = { horizontal: 'left', vertical: 'center', indent: 1 };

        for (let i = 0; i < periods.length; i++) {
            const cell = fxRow.getCell(i + 2);
            cell.value = data.fxEffects[i] || 0;
            cell.numFmt = '#,##0.00';
            cell.alignment = { horizontal: 'right', vertical: 'center' };
        }
        currentRow++;
    }

    const beginRow = worksheet.getRow(currentRow);
    beginRow.getCell(1).value = 'Cash and cash equivalents at beginning of period';
    beginRow.getCell(1).font = { name: 'Arial', size: 10 };
    beginRow.getCell(1).alignment = { horizontal: 'left', vertical: 'center', indent: 1 };

    for (let i = 0; i < periods.length; i++) {
        const cell = beginRow.getCell(i + 2);
        cell.value = data.cashBeginning[i] || 0;
        cell.numFmt = '#,##0.00';
        cell.alignment = { horizontal: 'right', vertical: 'center' };
    }
    const beginBalanceRow = currentRow;
    currentRow++;

    const endRow = worksheet.getRow(currentRow);
    endRow.getCell(1).value = 'Cash and cash equivalents at end of period';
    endRow.getCell(1).font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    endRow.getCell(1).alignment = { horizontal: 'left', vertical: 'center', indent: 1 };
    endRow.getCell(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' }
    };

    for (let i = 0; i < periods.length; i++) {
        const cell = endRow.getCell(i + 2);
        const colLetter = getColumnLetter(i + 2);

        let formula;
        if (fxEffectsRow) {
            formula = `=${colLetter}${beginBalanceRow}+${colLetter}${netChangeRow}+${colLetter}${fxEffectsRow}`;
        } else {
            formula = `=${colLetter}${beginBalanceRow}+${colLetter}${netChangeRow}`;
        }

        cell.value = { formula: formula };
        cell.numFmt = '#,##0.00';
        cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.alignment = { horizontal: 'right', vertical: 'center' };
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4472C4' }
        };
        cell.border = {
            top: { style: 'medium' },
            bottom: { style: 'double' }
        };
    }
    endRow.height = 22;

    return currentRow + 1;
}

function getColumnLetter(columnNumber) {
    let letter = '';
    while (columnNumber > 0) {
        const remainder = (columnNumber - 1) % 26;
        letter = String.fromCharCode(65 + remainder) + letter;
        columnNumber = Math.floor((columnNumber - 1) / 26);
    }
    return letter;
}

module.exports = {
    styleCashFlowReport
};