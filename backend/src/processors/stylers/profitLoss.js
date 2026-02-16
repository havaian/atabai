// utils/stylers/profitLoss.js
// Renders the IFRS P&L layout descriptor produced by the transformer
// into a styled ExcelJS workbook. Follows the same alternating-row
// colour pattern used by the cash flow styler.

'use strict';

const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

const {
    FONT_PRESETS,
    BRAND_COLORS,
    PRIMARY_FONT
} = require('./fontConfig');

// ─── Style constants ──────────────────────────────────────────────────────────

const NUM_FMT = '#,##0.00;(#,##0.00)';

// Alternating row fills
const FILL_WHITE = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
const FILL_LIGHT = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_COLORS.lightBlue } };
// Column-header fill
const FILL_HEADER = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_COLORS.headerBlue } };
// Section-title accent fill
const FILL_SECTION = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
// Totals / calculated rows
const FILL_TOTAL = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_COLORS.lightBlue } };

const BORDER_THIN = { style: 'thin', color: { argb: 'FFBFBFBF' } };
const BORDER_MEDIUM = { style: 'medium', color: { argb: 'FF8EA9C1' } };

const ALIGN_LEFT = { horizontal: 'left', vertical: 'middle', indent: 0 };
const ALIGN_RIGHT = { horizontal: 'right', vertical: 'middle' };
const ALIGN_CENTER = { horizontal: 'center', vertical: 'middle' };

// ─── Logo helper ──────────────────────────────────────────────────────────────

async function tryAddLogo(workbook, worksheet, periodCount) {
    const logoPath = '/app/public/assets/images/icons/logo-text-uc.png';

    if (fs.existsSync(logoPath)) {
        try {
            const logoId = workbook.addImage({ 
                    filename: logoPath, 
                    extension: 'png' 
                });

            worksheet.addImage(logoId, {
                tl: { col: 0, row: 0 },
                ext: { width: 188, height: 50 }
            });

            worksheet.getRow(1).height = 50;

            global.logger.logInfo(`[PL STYLER] Logo loaded from: ${logoPath}`);
            return true;
        } catch {
            // try next path
        }
    }

    global.logger.logWarn('[PL STYLER] Logo not found, using text fallback');
    return false;
}

// ─── Excel column letter helper ───────────────────────────────────────────────

function colLetter(index) {
    // index is 1-based (column A = 1)
    let letter = '';
    let idx = index;
    while (idx > 0) {
        const rem = (idx - 1) % 26;
        letter = String.fromCharCode(65 + rem) + letter;
        idx = Math.floor((idx - 1) / 26);
    }
    return letter;
}

// ─── Core styler function ─────────────────────────────────────────────────────

/**
 * Style the IFRS P&L layout into an ExcelJS workbook.
 *
 * @param {Object} data
 * @param {Object[]} data.periods   - [{ label }] period array
 * @param {Object[]} data.rows      - transformer rows array
 * @param {Object}   data.namedRefs - { totalRevenue, totalCOGS, grossProfit } row indices
 * @param {string}   [data.companyName]
 * @param {string}   [data.title]
 * @returns {ExcelJS.Workbook}
 */
async function styleProfitLossReport(data) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('IFRS P&L Statement');

    const periods = data.periods || [];
    const periodCount = periods.length;
    const layoutRows = data.rows || [];
    const namedRefs = data.namedRefs || {};

    // ── Column widths ─────────────────────────────────────────────────────────
    worksheet.getColumn(1).width = 55;  // label column
    for (let i = 0; i < periodCount; i++) {
        worksheet.getColumn(i + 2).width = 18;
    }

    let excelRow = 1; // current Excel row (1-based)
    let dataRowCounter = 0; // for alternating colours

    // ── Logo / Header ─────────────────────────────────────────────────────────
    const logoFound = await tryAddLogo(workbook, worksheet, periodCount);

    if (logoFound) {
        worksheet.getRow(excelRow).height = 44;
        excelRow += 2;
    } else {
        const logoRow = worksheet.getRow(excelRow);
        logoRow.getCell(1).value = 'ATABAI';
        logoRow.getCell(1).font = { name: PRIMARY_FONT, size: 16, bold: true, color: { argb: BRAND_COLORS.primary } };
        logoRow.getCell(1).alignment = ALIGN_CENTER;
        worksheet.mergeCells(excelRow, 1, excelRow, periodCount + 1);
        logoRow.height = 36;
        excelRow += 2;
    }

    // ── Report title ──────────────────────────────────────────────────────────
    const titleText = data.title || 'PROFIT & LOSS STATEMENT (IFRS)';
    const titleRow = worksheet.getRow(excelRow);
    titleRow.getCell(1).value = titleText;
    titleRow.getCell(1).font = { name: PRIMARY_FONT, size: 14, bold: true };
    titleRow.getCell(1).alignment = ALIGN_CENTER;
    worksheet.mergeCells(excelRow, 1, excelRow, periodCount + 1);
    titleRow.height = 22;
    excelRow++;

    // Company name (if provided)
    if (data.companyName) {
        const cnRow = worksheet.getRow(excelRow);
        cnRow.getCell(1).value = data.companyName;
        cnRow.getCell(1).font = { name: PRIMARY_FONT, size: 11, bold: true };
        cnRow.getCell(1).alignment = ALIGN_CENTER;
        worksheet.mergeCells(excelRow, 1, excelRow, periodCount + 1);
        excelRow++;
    }

    excelRow++; // blank spacer

    // ── Column header row ─────────────────────────────────────────────────────
    const headerExcelRow = excelRow;
    const hRow = worksheet.getRow(excelRow);

    hRow.getCell(1).value = 'Line Items';
    hRow.getCell(1).font = { name: PRIMARY_FONT, size: 10, bold: true, color: { argb: BRAND_COLORS.white } };
    hRow.getCell(1).fill = FILL_HEADER;
    hRow.getCell(1).alignment = ALIGN_LEFT;

    for (let i = 0; i < periodCount; i++) {
        const cell = hRow.getCell(i + 2);
        cell.value = periods[i].label;
        cell.font = { name: PRIMARY_FONT, size: 10, bold: true, color: { argb: BRAND_COLORS.white } };
        cell.fill = FILL_HEADER;
        cell.alignment = ALIGN_RIGHT;
    }
    hRow.height = 18;
    excelRow++;

    // ── Map layout row index → Excel row number ───────────────────────────────
    // We need this to build formulas referencing other rows.
    // First pass: assign Excel row numbers to each layout row.
    // (blank rows get a row number too; they just have no content)

    const layoutToExcel = new Array(layoutRows.length).fill(0);
    let excelRowCursor = excelRow;

    for (let li = 0; li < layoutRows.length; li++) {
        layoutToExcel[li] = excelRowCursor;
        excelRowCursor++;
    }

    // ── Second pass: write all rows ───────────────────────────────────────────

    function getAltFill() {
        dataRowCounter++;
        return dataRowCounter % 2 === 0 ? FILL_LIGHT : FILL_WHITE;
    }

    /**
     * Build an Excel SUM formula referencing only 'item' rows in the range.
     * Subheader rows are skipped — they carry no values and must not be summed.
     * sumRange: { from, to } (exclusive) indices into layoutRows[].
     *
     * If all item rows are contiguous in Excel we emit a single range for brevity.
     * If subheaders break the sequence we enumerate individual cell refs inside SUM.
     */
    function buildSumFormula(sumRange, col) {
        const c = colLetter(col);

        // Collect Excel row numbers for item rows only
        const itemExcelRows = [];
        for (let li = sumRange.from; li < sumRange.to; li++) {
            if (layoutRows[li].type === 'item') {
                itemExcelRows.push(layoutToExcel[li]);
            }
        }

        if (itemExcelRows.length === 0) return `=0`;
        if (itemExcelRows.length === 1) return `=${c}${itemExcelRows[0]}`;

        // Check contiguity in Excel row numbers
        let contiguous = true;
        for (let i = 1; i < itemExcelRows.length; i++) {
            if (itemExcelRows[i] !== itemExcelRows[i - 1] + 1) { contiguous = false; break; }
        }

        if (contiguous) {
            return { formula:`=SUM(${c}${itemExcelRows[0]}:${c}${itemExcelRows[itemExcelRows.length - 1]})` };
        }
        // Non-contiguous: enumerate refs inside SUM
        return { formula: `=SUM(${itemExcelRows.map(r => `${c}${r}`).join(',')})` };
    }

    /**
     * Build an addRefs formula (sum of specific referenced rows).
     * addRefs: array of layout-row indices OR named ref strings.
     */
    function buildAddFormula(addRefs, col) {
        const resolved = addRefs.map((ref) => {
            if (typeof ref === 'string') {
                // Named reference – look up in namedRefs
                const li = namedRefs[ref];
                return li !== undefined ? layoutToExcel[li] : null;
            }
            return layoutToExcel[ref];
        }).filter(Boolean);

        if (resolved.length === 0) return '=0';
        const c = colLetter(col);
        return { formula: '=' + resolved.map((r) => `${c}${r}`).join('+') };
    }

    for (let li = 0; li < layoutRows.length; li++) {
        const lRow = layoutRows[li];
        const eRowN = layoutToExcel[li];
        const eRow = worksheet.getRow(eRowN);

        switch (lRow.type) {

            case 'blank':
                eRow.height = 6;
                break;

            case 'title': {
                const fill = getAltFill();
                const cell = eRow.getCell(1);
                cell.value = lRow.label;
                cell.font = { name: PRIMARY_FONT, size: 10, bold: true };
                cell.fill = FILL_SECTION;
                cell.alignment = ALIGN_LEFT;
                // Fill remaining columns with section background
                for (let i = 0; i < periodCount; i++) {
                    const c = eRow.getCell(i + 2);
                    c.fill = FILL_SECTION;
                }
                eRow.height = 16;
                break;
            }

            case 'subheader': {
                const cell = eRow.getCell(1);
                cell.value = lRow.label;
                cell.font = { name: PRIMARY_FONT, size: 10, bold: false, italic: true };
                cell.fill = getAltFill();
                cell.alignment = ALIGN_LEFT;
                for (let i = 0; i < periodCount; i++) {
                    eRow.getCell(i + 2).fill = eRow.getCell(1).fill;
                }
                eRow.height = 15;
                break;
            }

            case 'item': {
                const fill = getAltFill();
                const cell = eRow.getCell(1);
                cell.value = lRow.label;
                cell.font = { name: PRIMARY_FONT, size: 10 };
                cell.fill = fill;
                cell.alignment = ALIGN_LEFT;

                for (let i = 0; i < periodCount; i++) {
                    const c = eRow.getCell(i + 2);
                    c.fill = fill;
                    c.font = { name: PRIMARY_FONT, size: 10 };
                    c.alignment = ALIGN_RIGHT;
                    c.numFmt = NUM_FMT;

                    const v = lRow.values ? lRow.values[i] : null;
                    // Write null/0 as empty (blank cell) for project items and dynamic items
                    c.value = (v === null || v === 0) ? null : v;
                }
                eRow.height = 15;
                break;
            }

            case 'total': {
                const fill = FILL_TOTAL;
                const cell = eRow.getCell(1);
                cell.value = lRow.label;
                cell.font = { name: PRIMARY_FONT, size: 10, bold: true };
                cell.fill = fill;
                cell.alignment = ALIGN_LEFT;

                for (let i = 0; i < periodCount; i++) {
                    const c = eRow.getCell(i + 2);
                    c.fill = fill;
                    c.font = { name: PRIMARY_FONT, size: 10, bold: true };
                    c.alignment = ALIGN_RIGHT;
                    c.numFmt = NUM_FMT;
                    c.value = buildSumFormula(lRow.sumRange, i + 2);
                }

                // Bottom border to visually separate totals
                eRow.eachCell({ includeEmpty: false }, (cell) => {
                    cell.border = { bottom: BORDER_MEDIUM };
                });
                eRow.height = 16;
                dataRowCounter++;
                break;
            }

            case 'calculated': {
                const fill = FILL_TOTAL;
                const cell = eRow.getCell(1);
                cell.value = lRow.label;
                cell.font = { name: PRIMARY_FONT, size: 10, bold: true };
                cell.fill = fill;
                cell.alignment = ALIGN_LEFT;

                for (let i = 0; i < periodCount; i++) {
                    const c = eRow.getCell(i + 2);
                    c.fill = fill;
                    c.font = { name: PRIMARY_FONT, size: 10, bold: true };
                    c.alignment = ALIGN_RIGHT;
                    c.numFmt = NUM_FMT;
                    c.value = buildAddFormula(lRow.addRefs, i + 2);
                }

                eRow.eachCell({ includeEmpty: false }, (cell) => {
                    cell.border = { top: BORDER_THIN, bottom: BORDER_MEDIUM };
                });
                eRow.height = 16;
                dataRowCounter++;
                break;
            }

            default:
                break;
        }
    }

    // ── Freeze panes: header + column-A frozen ────────────────────────────────
    worksheet.views = [{ state: 'frozen', xSplit: 1, ySplit: headerExcelRow }];

    global.logger.logInfo(`[PL STYLER] Workbook built, total Excel rows: ${excelRowCursor}`);

    return workbook;
}

module.exports = { styleProfitLossReport };