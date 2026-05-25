// @ts-nocheck
/**
 * Auto-converted from src/processors/stylers/equity.js.
 * Algorithm preserved verbatim; only module syntax was changed.
 *  keeps Phase 6 unblocked while the deep typing work is
 * deferred — every export is consumed via PROCESSOR_SERVICE which is
 * typed against IProcessorService at the boundary.
 */

// processors/stylers/equity.js
// Renders the IFRS Statement of Changes in Equity layout descriptor
// into a styled ExcelJS workbook.import * as ExcelJS from 'exceljs';
import {addLogoRow} from './logo-helper';
import {BRAND_COLORS, PRIMARY_FONT} from './font-config';
export const NUM_FMT = '#,##0.00;(#,##0.00)';
export const FILL_HEADER = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_COLORS.headerBlue } };
export const FILL_TOTAL = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_COLORS.lightBlue } };
export const FILL_ALT = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_COLORS.lightBlue } };
export const FILL_SECTION = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
export const BORDER_THIN = { style: 'thin', color: { argb: 'FFBFBFBF' } };
export const BORDER_MED = { style: 'medium', color: { argb: 'FF8EA9C1' } };

export function colLetter(n) {
    let l = '';
    while (n > 0) {
        const r = (n - 1) % 26;
        l = String.fromCharCode(65 + r) + l;
        n = Math.floor((n - 1) / 26);
    }
    return l;
}

export function applyBorder(cell, type = 'thin') {
    const s = type === 'medium' ? BORDER_MED : BORDER_THIN;
    cell.border = { top: s, bottom: s, left: s, right: s };
}

/**
 * Style and render the equity layout descriptor.
 *
 * @param {Object} data - Output of transformToIFRSEquity()
 * @returns {ExcelJS.Workbook}
 */
export async function styleEquityReport(data) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Changes in Equity');

    const columns = data.columns || [];
    const layoutRows = data.rows || [];
    const totalCols = columns.length + 1; // +1 for row label column

    // ── Column widths ─────────────────────────────────────────────────────────
    worksheet.getColumn(1).width = 42; // row label
    columns.forEach((_, i) => { worksheet.getColumn(i + 2).width = 18; });

    let currentRow = 1;
    let dataRowCounter = 0;

    // ── Logo ──────────────────────────────────────────────────────────────────
    await addLogoRow(workbook, worksheet, currentRow, totalCols);
    currentRow += 2;

    // ── Title ─────────────────────────────────────────────────────────────────
    worksheet.mergeCells(currentRow, 1, currentRow, totalCols);
    const titleCell = worksheet.getCell(currentRow, 1);
    titleCell.value = 'STATEMENT OF CHANGES IN EQUITY (IFRS)';
    titleCell.font = { name: PRIMARY_FONT, size: 14, bold: true };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(currentRow).height = 24;
    currentRow++;

    if (data.companyName) {
        worksheet.mergeCells(currentRow, 1, currentRow, totalCols);
        const nameCell = worksheet.getCell(currentRow, 1);
        nameCell.value = data.companyName;
        nameCell.font = { name: PRIMARY_FONT, size: 12, bold: true };
        nameCell.alignment = { horizontal: 'center', vertical: 'middle' };
        currentRow++;
    }

    currentRow++; // blank spacer

    // ── Column headers ────────────────────────────────────────────────────────
    const hRow = worksheet.getRow(currentRow);
    hRow.getCell(1).value = 'Movement';
    hRow.getCell(1).font = { name: PRIMARY_FONT, size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    hRow.getCell(1).fill = FILL_HEADER;
    hRow.getCell(1).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
    applyBorder(hRow.getCell(1));

    columns.forEach((col, i) => {
        const cell = hRow.getCell(i + 2);
        cell.value = col.label;
        cell.font = { name: PRIMARY_FONT, size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = FILL_HEADER;
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        applyBorder(cell);
    });
    hRow.height = 40;
    currentRow++;
    dataRowCounter++;

    // ── Data rows ─────────────────────────────────────────────────────────────
    // Track total-row positions for potential formula use in future
    const totalRowPositions = {};

    for (const layoutRow of layoutRows) {
        const isTotal = layoutRow.isTotal;
        const fill = isTotal ? FILL_TOTAL : (dataRowCounter % 2 === 0 ? null : FILL_ALT);
        const font = { name: PRIMARY_FONT, size: 10, bold: isTotal };

        const eRow = worksheet.getRow(currentRow);

        // Label cell
        const labelCell = eRow.getCell(1);
        labelCell.value = layoutRow.label;
        labelCell.font = font;
        labelCell.fill = fill || { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
        labelCell.alignment = { horizontal: 'left', vertical: 'middle', indent: isTotal ? 0 : 1 };
        applyBorder(labelCell, isTotal ? 'medium' : 'thin');

        // Value cells
        columns.forEach((col, i) => {
            const cell = eRow.getCell(i + 2);
            const val = layoutRow.values?.[col.key];
            cell.value = (val === null || val === undefined) ? null : val;
            cell.font = font;
            cell.fill = fill || { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
            cell.numFmt = NUM_FMT;
            applyBorder(cell, isTotal ? 'medium' : 'thin');
        });

        eRow.height = isTotal ? 20 : 16;

        if (isTotal) totalRowPositions[layoutRow.key] = currentRow;
        currentRow++;
        dataRowCounter++;
    }

    // ── Source note (for balance-sheet-sourced output) ────────────────────────
    if (data.sourceNote) {
        currentRow++;
        worksheet.mergeCells(currentRow, 1, currentRow, totalCols);
        const noteCell = worksheet.getCell(currentRow, 1);
        noteCell.value = `ℹ  ${data.sourceNote}`;
        noteCell.font = { name: PRIMARY_FONT, size: 9, italic: true, color: { argb: 'FF666666' } };
        noteCell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
        worksheet.getRow(currentRow).height = 32;
        currentRow++;
    }

    // ── Watermark ─────────────────────────────────────────────────────────────
    currentRow += 2;
    worksheet.mergeCells(currentRow, 1, currentRow, totalCols);
    const watermarkCell = worksheet.getCell(currentRow, 1);
    watermarkCell.value = 'Processed by ATABAI';
    watermarkCell.font = { name: PRIMARY_FONT, size: 9, italic: true, color: { argb: BRAND_COLORS.primary } };
    watermarkCell.alignment = { horizontal: 'right' };

    return workbook;
}

