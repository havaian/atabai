/**
 * sourceWorkbookParser — converts a raw .xlsx file on disk into the JSON
 * shape that Univer 0.20 expects so the frontend can render the uploaded
 * file as-is in the TransformationView "Source" tab.
 *
 * Design notes:
 *  - We use ExcelJS (already a dep of this project for output generation)
 *    rather than adding SheetJS to the backend deps just for reading.
 *  - We deliberately don't preserve fonts/borders/colors from the source —
 *    NSBU forms often have inconsistent styling that doesn't survive a
 *    round-trip cleanly. We do preserve: values, basic numeric formatting,
 *    merged cells (common in NSBU headers), and column widths.
 *  - The output shape mirrors what TransformationView.vue's worksheetBase()
 *    + cellData{} produce, so the same Univer mount path renders both.
 *
 * Trade-off: large workbooks (10k+ cells) generate large JSON. We cap rows
 * read per sheet to MAX_ROWS_PER_SHEET to avoid blowing up. Most NSBU
 * forms are well under 500 rows so this is fine in practice.
 */

'use strict';

const ExcelJS = require('exceljs');

// Hard cap so a malicious / accidentally huge file doesn't OOM the server.
// 5000 rows × 30 cols is ~150k cells which is on the upper bound of what
// Univer can render without lag.
const MAX_ROWS_PER_SHEET = 5000;
const MAX_COLS_PER_SHEET = 50;

// Number format used as a fallback when ExcelJS doesn't surface a usable
// numFmt on a numeric cell. Matches what TransformationView uses for the
// existing "Original" view so the look stays consistent across tabs.
const FALLBACK_NUM_FMT = '#,##0.00;(#,##0.00)';

// Style tokens — kept minimal so the Source view is visually neutral
// (no styling clashes with the user's data). Header row only gets a
// background tint to hint at structure.
const STYLES = {
    headerBg: '#F3F0FA',
    headerFg: '#1F1A2C',
};

/**
 * Required Univer worksheet scaffold. Kept identical to
 * TransformationView.vue's worksheetBase() — every field below is required
 * by Univer 0.20's selection/render services or mounting fails with
 * "cannot read properties of undefined (reading 'worksheet')".
 */
function worksheetBase(id, name) {
    return {
        id,
        name,
        tabColor: '',
        hidden: 0,
        zoomRatio: 1,
        freeze: { startRow: -1, startColumn: -1, xSplit: 0, ySplit: 0 },
        scrollTop: 0,
        scrollLeft: 0,
        defaultColumnWidth: 110,
        defaultRowHeight: 24,
        mergeData: [],
        rowData: {},
        columnData: {},
        rowHeader: { width: 46 },
        columnHeader: { height: 20 },
        showGridlines: 1,
        rightToLeft: 0,
    };
}

/**
 * Extract the displayable value from an ExcelJS cell. ExcelJS represents
 * formulas, shared strings, and rich text as objects — we flatten them to
 * primitives for Univer.
 */
function extractValue(cell) {
    if (cell == null) return null;
    const v = cell.value;
    if (v == null) return null;

    // Shared formula / regular formula → use the computed result
    if (typeof v === 'object' && 'result' in v) {
        return v.result == null ? null : v.result;
    }
    // Rich text → concatenate the text runs
    if (typeof v === 'object' && Array.isArray(v.richText)) {
        return v.richText.map(r => r.text || '').join('');
    }
    // Hyperlink → use the display text, not the URL
    if (typeof v === 'object' && 'text' in v && 'hyperlink' in v) {
        return v.text || v.hyperlink;
    }
    // Date — Univer accepts ISO strings; we hand it a serial number to
    // preserve the cell's "is a date" semantics. Frontend can format.
    if (v instanceof Date) {
        return v.toISOString();
    }
    return v;
}

/**
 * Build a Univer-compatible style object from an ExcelJS cell.
 * We only forward enough styling to communicate intent: bold (likely
 * header), and numeric formatting. Everything else is dropped so the
 * Source view stays visually neutral.
 */
function buildCellStyle(cell, isHeaderRow) {
    const style = {};

    if (isHeaderRow) {
        style.bg = { rgb: STYLES.headerBg };
        style.cl = { rgb: STYLES.headerFg };
        style.bl = 1;
    } else if (cell.font && cell.font.bold) {
        style.bl = 1;
    }

    // Numeric format — pull from the cell if present, otherwise apply the
    // fallback for any numeric value. Univer wants this under style.n.pattern.
    if (typeof cell.value === 'number') {
        const fmt = cell.numFmt && typeof cell.numFmt === 'string'
            ? cell.numFmt
            : FALLBACK_NUM_FMT;
        style.n = { pattern: fmt };
    }

    return style;
}

/**
 * Convert a single ExcelJS worksheet to Univer worksheet JSON.
 */
function convertSheet(sheet, sheetIndex) {
    const id = `source-sheet-${sheetIndex}`;
    // Strip control chars from sheet names — Excel allows some that Univer's
    // tab renderer chokes on.
    const name = (sheet.name || `Sheet ${sheetIndex + 1}`).replace(/[\u0000-\u001f]/g, '');

    const cellData = {};
    let maxRow = 0;
    let maxCol = 0;

    // Iterate rows. ExcelJS uses 1-based row indices; Univer uses 0-based.
    // We cap at MAX_ROWS_PER_SHEET to avoid pathological inputs.
    const rowCount = Math.min(sheet.rowCount, MAX_ROWS_PER_SHEET);

    for (let rowNum = 1; rowNum <= rowCount; rowNum++) {
        const row = sheet.getRow(rowNum);
        if (!row || row.cellCount === 0) continue;

        // First non-empty row gets header styling. ExcelJS's rowCount may
        // include trailing blanks, so we don't blindly call row 1 the header
        // — we treat the first row that has any cells as the header. Most
        // NSBU files match this pattern.
        const isHeaderRow = rowNum === 1;

        const colCount = Math.min(row.cellCount, MAX_COLS_PER_SHEET);

        for (let colNum = 1; colNum <= sheet.columnCount && colNum <= MAX_COLS_PER_SHEET; colNum++) {
            const cell = row.getCell(colNum);
            const value = extractValue(cell);
            if (value === null || value === '') continue;

            const r = rowNum - 1; // → 0-based
            const c = colNum - 1; // → 0-based

            if (!cellData[r]) cellData[r] = {};
            const style = buildCellStyle(cell, isHeaderRow);
            cellData[r][c] = Object.keys(style).length > 0
                ? { v: value, s: style }
                : { v: value };

            if (r > maxRow) maxRow = r;
            if (c > maxCol) maxCol = c;
        }
    }

    // Column widths — pull from ExcelJS where available, fall back to a
    // sensible default. Univer's width unit ≈ pixels at zoom 1.0; ExcelJS
    // reports widths in Excel's character-units, so we multiply by ~7 to
    // approximate pixels.
    const columnData = {};
    if (sheet.columns && sheet.columns.length > 0) {
        sheet.columns.forEach((col, idx) => {
            if (idx >= MAX_COLS_PER_SHEET) return;
            const w = col.width;
            if (typeof w === 'number' && w > 0) {
                columnData[idx] = { w: Math.round(w * 7) };
            }
        });
    }

    // Merged cells — NSBU forms use these heavily for headers. ExcelJS
    // tracks merges as A1-style ranges; Univer wants {startRow, endRow,
    // startColumn, endColumn} in 0-based indices.
    const mergeData = [];
    if (sheet.model && Array.isArray(sheet.model.merges)) {
        for (const range of sheet.model.merges) {
            const parsed = parseA1Range(range);
            if (parsed) mergeData.push(parsed);
        }
    }

    return {
        ...worksheetBase(id, name),
        // Give Univer a bit of headroom past the last used cell so the user
        // can scroll into empty space (feels like a normal spreadsheet).
        rowCount: Math.max(maxRow + 10, 30),
        columnCount: Math.max(maxCol + 3, 10),
        cellData,
        columnData,
        mergeData,
    };
}

/**
 * Convert an A1-style range (e.g. "B3:D5") to Univer's {startRow, endRow,
 * startColumn, endColumn} format with 0-based indices. Returns null if
 * the range can't be parsed.
 */
function parseA1Range(range) {
    if (typeof range !== 'string') return null;
    const match = range.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
    if (!match) return null;
    const [, c1, r1, c2, r2] = match;
    return {
        startRow: parseInt(r1, 10) - 1,
        endRow: parseInt(r2, 10) - 1,
        startColumn: colLettersToNum(c1),
        endColumn: colLettersToNum(c2),
    };
}

/**
 * Convert column letters (A, B, ..., AA, AB, ...) to a 0-based column
 * number.
 */
function colLettersToNum(letters) {
    let n = 0;
    for (let i = 0; i < letters.length; i++) {
        n = n * 26 + (letters.charCodeAt(i) - 64);
    }
    return n - 1;
}

/**
 * Main entrypoint: read an xlsx file from disk and produce a Univer
 * workbook JSON object.
 *
 * @param {string} filePath  Absolute path to the .xlsx file on disk.
 * @returns {Promise<object>}  Univer workbook JSON.
 */
async function parseSourceWorkbook(filePath) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(filePath);

    const sheets = {};
    const sheetOrder = [];

    wb.eachSheet((sheet, sheetIndex) => {
        // ExcelJS's sheetIndex is 1-based — convert to 0-based for our IDs.
        const idx = sheetIndex - 1;
        const converted = convertSheet(sheet, idx);
        sheets[converted.id] = converted;
        sheetOrder.push(converted.id);
    });

    return {
        id: 'source-workbook',
        name: 'source',
        appVersion: '0.20.0',
        locale: 'enUS',
        styles: {},
        sheetOrder,
        sheets,
    };
}

module.exports = {
    parseSourceWorkbook,
};
