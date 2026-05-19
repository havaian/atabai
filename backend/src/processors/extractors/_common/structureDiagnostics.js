// processors/extractors/_common/structureDiagnostics.js
//
// Defensive helpers used by all NSBU extractors. Two purposes:
//
//   1. FALLBACK HEURISTICS — when the primary token-based detection (e.g.
//      "find a cell containing 'сатр коди'") fails because the file uses a
//      different header term, these functions try structural / statistical
//      detection (e.g. "find the column where >5 cells contain 3-digit codes").
//      The goal is graceful degradation: instead of throwing on day 1 of a
//      new NSBU format variant, we extract what we can and report what we
//      couldn't.
//
//   2. DIAGNOSTIC ERRORS — when even the fallback fails, we throw an error
//      that includes structured info about the sheet (row count, sampled
//      cells in the header region, what tokens were searched for) so the
//      developer can quickly understand WHY extraction failed without
//      opening the actual .xlsx.
//
// This module deliberately does NOT replace the existing token-based logic.
// The original logic stays as the fast path (it works for the formats we've
// already seen). Fallbacks only kick in when the fast path returns null.
//
// Why not refactor extractors top-to-bottom? Because the primary cause of
// "factory production" parsing bugs has been ONE missing heuristic per new
// format, not a fundamental design flaw. Adding fallback paths is much
// safer than rewriting and gives us telemetry to know which heuristics need
// strengthening.

'use strict';

const { getCell, eachCellInRow } = require('../../readers/excelReader');

/**
 * Normalize a string for token matching:
 *   - lowercase
 *   - trim
 *   - collapse internal whitespace
 *   - strip BOMs and zero-width chars some Excel exports include
 */
function normalizeText(value) {
    if (value === null || value === undefined) return '';
    return String(value)
        .toLowerCase()
        .replace(/[\u200B-\u200D\uFEFF]/g, '') // zero-width chars
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Stringify any cell value (string, number, Date, ExcelJS rich text, etc.)
 * to a plain string. Mirrors what the extractors do locally so callers can
 * use this helper uniformly instead of re-implementing it.
 */
function cellToText(cell) {
    if (cell === null || cell === undefined) return '';
    if (typeof cell === 'string') return cell;
    if (typeof cell === 'number') return String(cell);
    if (cell instanceof Date) return cell.toISOString();
    if (typeof cell === 'object') {
        // ExcelJS shapes
        if (typeof cell.text === 'string') return cell.text;
        if (typeof cell.value === 'string') return cell.value;
        if (typeof cell.value === 'number') return String(cell.value);
        if (cell.richText && Array.isArray(cell.richText)) {
            return cell.richText.map(r => r.text || '').join('');
        }
        if (cell.result !== undefined) return String(cell.result);
        if (cell.formula) return ''; // formula with no cached result
    }
    return String(cell);
}

/**
 * Test if a cell looks like an NSBU row code: 2-4 digit number, optionally
 * zero-padded (e.g. "010", "0150", "020"). NSBU uses codes in 010..999 range
 * for balance sheet and cash flow; P&L Form 2 uses similar ranges. We accept
 * leading zeros and trim them when comparing.
 */
function looksLikeNsbuCode(text) {
    const t = normalizeText(text);
    if (!/^0*\d{1,4}$/.test(t)) return false;
    const n = parseInt(t, 10);
    return n >= 10 && n <= 9999;
}

/**
 * Find the most likely "code column" in a sheet by counting cells that look
 * like NSBU codes per column, within a scan window.
 *
 * Returns { column, hits, scannedRows } or null if no column has enough hits.
 *
 * @param {Object} sheet - normalized sheet from excelReader
 * @param {Object} opts
 *   - scanRows: how many rows to scan from the top (default 200)
 *   - minHits: minimum number of code-like cells to declare a column the
 *              code column (default 5). Tuned so a stray "010" in a comment
 *              doesn't trigger detection.
 *   - maxColumn: column index ceiling — NSBU files almost never put codes
 *              past column 10 (default 15)
 */
function findCodeColumnByDensity(sheet, opts = {}) {
    const scanRows = Math.min(sheet.rowCount || 0, opts.scanRows || 200);
    const minHits = opts.minHits || 5;
    const maxColumn = opts.maxColumn || 15;
    if (scanRows === 0) return null;

    const hitsByColumn = new Map();

    for (let rowNum = 1; rowNum <= scanRows; rowNum++) {
        eachCellInRow(sheet, rowNum, (cell, colNum) => {
            if (colNum > maxColumn) return;
            if (looksLikeNsbuCode(cellToText(cell))) {
                hitsByColumn.set(colNum, (hitsByColumn.get(colNum) || 0) + 1);
            }
        });
    }

    if (hitsByColumn.size === 0) return null;

    // Pick the column with the most code-like cells. Ties: prefer leftmost
    // (NSBU forms conventionally put the code column near the start).
    let bestColumn = null;
    let bestHits = 0;
    for (const [colNum, hits] of hitsByColumn) {
        if (hits > bestHits || (hits === bestHits && (bestColumn === null || colNum < bestColumn))) {
            bestColumn = colNum;
            bestHits = hits;
        }
    }

    if (bestHits < minHits) return null;
    return { column: bestColumn, hits: bestHits, scannedRows: scanRows };
}

/**
 * Given a known code column, find the first row that contains an NSBU code
 * in that column — that's the start of the data block.
 *
 * Returns row number, or null if no such row exists in the scan window.
 */
function findDataStartRow(sheet, codeColumn, opts = {}) {
    const scanRows = Math.min(sheet.rowCount || 0, opts.scanRows || 300);
    for (let rowNum = 1; rowNum <= scanRows; rowNum++) {
        const cell = getCell(sheet, rowNum, codeColumn);
        if (cell && looksLikeNsbuCode(cellToText(cell))) {
            return rowNum;
        }
    }
    return null;
}

/**
 * Given a known data start row, find a column that "looks like" a name
 * column — usually adjacent to the code column and filled with longer text.
 *
 * Heuristic: among columns 1..maxColumn, pick the one where text cells in
 * the data rows have the highest average length.
 *
 * Returns column number or null.
 */
function findNameColumnByTextDensity(sheet, dataStartRow, opts = {}) {
    const scanRows = Math.min(
        sheet.rowCount || 0,
        dataStartRow + (opts.scanRows || 80)
    );
    const maxColumn = opts.maxColumn || 15;
    const stats = new Map(); // colNum → { totalLen, count }

    for (let rowNum = dataStartRow; rowNum <= scanRows; rowNum++) {
        eachCellInRow(sheet, rowNum, (cell, colNum) => {
            if (colNum > maxColumn) return;
            const text = cellToText(cell).trim();
            // Skip numeric cells — we want text-heavy columns
            if (!text || /^[\d\s.,\-()]+$/.test(text)) return;
            if (looksLikeNsbuCode(text)) return;
            // Skip very short labels like "I." or section markers
            if (text.length < 4) return;
            const cur = stats.get(colNum) || { totalLen: 0, count: 0 };
            cur.totalLen += text.length;
            cur.count += 1;
            stats.set(colNum, cur);
        });
    }

    if (stats.size === 0) return null;

    // Pick column with highest avg text length AND at least 5 hits (avoid
    // picking a column with one freak long string).
    let bestColumn = null;
    let bestAvg = 0;
    for (const [colNum, { totalLen, count }] of stats) {
        if (count < 5) continue;
        const avg = totalLen / count;
        if (avg > bestAvg) {
            bestAvg = avg;
            bestColumn = colNum;
        }
    }
    return bestColumn;
}

/**
 * Sample the top of a sheet for diagnostic output. Returns an array of
 * { row, col, text } for non-empty cells in the first `scanRows` rows /
 * `maxColumn` columns. Used to attach context to error messages.
 *
 * Capped at 80 cells to keep error payloads reasonable.
 */
function sampleHeaderRegion(sheet, opts = {}) {
    const scanRows = Math.min(sheet.rowCount || 0, opts.scanRows || 20);
    const maxColumn = opts.maxColumn || 12;
    const max = opts.max || 80;
    const out = [];
    for (let rowNum = 1; rowNum <= scanRows && out.length < max; rowNum++) {
        eachCellInRow(sheet, rowNum, (cell, colNum) => {
            if (colNum > maxColumn || out.length >= max) return;
            const text = cellToText(cell).trim();
            if (!text) return;
            // Truncate long values so the diagnostic stays compact
            const truncated = text.length > 60 ? text.slice(0, 57) + '...' : text;
            out.push({ row: rowNum, col: colNum, text: truncated });
        });
    }
    return out;
}

/**
 * Throw a diagnostic error describing what extraction expected vs. what it
 * actually saw on the sheet. The error message is intentionally verbose for
 * developer use — UI surfaces just the first line to the user.
 *
 * @param {string} reportType - 'balance_sheet', 'cash_flow', etc.
 * @param {string} what - what was being searched for (e.g. "code column")
 * @param {Object} sheet - the normalized sheet
 * @param {Object} details - { searchedFor: [...tokens], headerSample: [...], extra: {...} }
 */
function throwDiagnosticError(reportType, what, sheet, details = {}) {
    const searched = (details.searchedFor || []).join(', ') || '(no specific tokens)';
    const headerSample = details.headerSample || sampleHeaderRegion(sheet);
    const sampleStr = headerSample
        .slice(0, 20)
        .map(c => `  R${c.row}C${c.col}: "${c.text}"`)
        .join('\n');

    const extra = details.extra
        ? '\nAdditional context: ' + JSON.stringify(details.extra)
        : '';

    const err = new Error(
        `[${reportType}] Could not find ${what}.\n` +
        `Searched for tokens: ${searched}\n` +
        `Sheet has ${sheet.rowCount || 0} rows, ${sheet.columnCount || '?'} columns.\n` +
        `Top non-empty cells:\n${sampleStr || '  (none found)'}` +
        extra
    );
    // Attach structured info so the file controller / logger can index by it.
    err.diagnostic = {
        reportType,
        what,
        searchedFor: details.searchedFor || [],
        headerSample,
        rowCount: sheet.rowCount || 0,
        columnCount: sheet.columnCount,
        extra: details.extra
    };
    throw err;
}

// ─── Callback-based variants ───────────────────────────────────────────────
// The extractors for cashFlow and profitLossForm2 don't use the normalized
// excelReader API — they work on raw xlsx rows directly via either
// `getCellValue(rowIdx, colIdx)` or `row[colIdx]` arrays. These variants
// take an explicit cell-reading callback so the same diagnostic logic can
// serve all extractors without forcing them onto a common reader.
//
// Callback signature: (rowIdx, colIdx) => cellValue | null
// Row/col indices are 0-based here (matching xlsx convention), not 1-based
// like in the excelReader API.

function findCodeColumnByDensityCb(getCellValue, rowCount, opts = {}) {
    const scanRows = Math.min(rowCount || 0, opts.scanRows || 200);
    const minHits = opts.minHits || 5;
    const maxColumn = opts.maxColumn || 15;
    if (scanRows === 0) return null;

    const hitsByColumn = new Map();

    for (let r = 0; r < scanRows; r++) {
        for (let c = 0; c < maxColumn; c++) {
            const v = getCellValue(r, c);
            if (v === null || v === undefined) continue;
            if (looksLikeNsbuCode(cellToText(v))) {
                hitsByColumn.set(c, (hitsByColumn.get(c) || 0) + 1);
            }
        }
    }

    if (hitsByColumn.size === 0) return null;

    let bestColumn = null;
    let bestHits = 0;
    for (const [colIdx, hits] of hitsByColumn) {
        if (hits > bestHits || (hits === bestHits && (bestColumn === null || colIdx < bestColumn))) {
            bestColumn = colIdx;
            bestHits = hits;
        }
    }

    if (bestHits < minHits) return null;
    return { column: bestColumn, hits: bestHits, scannedRows: scanRows };
}

function sampleHeaderRegionCb(getCellValue, rowCount, opts = {}) {
    const scanRows = Math.min(rowCount || 0, opts.scanRows || 20);
    const maxColumn = opts.maxColumn || 12;
    const max = opts.max || 80;
    const out = [];
    for (let r = 0; r < scanRows && out.length < max; r++) {
        for (let c = 0; c < maxColumn && out.length < max; c++) {
            const v = getCellValue(r, c);
            if (v === null || v === undefined) continue;
            const text = cellToText(v).trim();
            if (!text) continue;
            const truncated = text.length > 60 ? text.slice(0, 57) + '...' : text;
            // Convert to 1-based for human-readable error messages.
            out.push({ row: r + 1, col: c + 1, text: truncated });
        }
    }
    return out;
}

function throwDiagnosticErrorCb(reportType, what, getCellValue, rowCount, columnCount, details = {}) {
    const searched = (details.searchedFor || []).join(', ') || '(no specific tokens)';
    const headerSample = details.headerSample || sampleHeaderRegionCb(getCellValue, rowCount);
    const sampleStr = headerSample
        .slice(0, 20)
        .map(c => `  R${c.row}C${c.col}: "${c.text}"`)
        .join('\n');

    const extra = details.extra
        ? '\nAdditional context: ' + JSON.stringify(details.extra)
        : '';

    const err = new Error(
        `[${reportType}] Could not find ${what}.\n` +
        `Searched for tokens: ${searched}\n` +
        `Sheet has ${rowCount || 0} rows, ${columnCount || '?'} columns.\n` +
        `Top non-empty cells:\n${sampleStr || '  (none found)'}` +
        extra
    );
    err.diagnostic = {
        reportType,
        what,
        searchedFor: details.searchedFor || [],
        headerSample,
        rowCount: rowCount || 0,
        columnCount,
        extra: details.extra
    };
    throw err;
}

module.exports = {
    normalizeText,
    cellToText,
    looksLikeNsbuCode,
    findCodeColumnByDensity,
    findDataStartRow,
    findNameColumnByTextDensity,
    sampleHeaderRegion,
    throwDiagnosticError,
    // Callback-based variants for extractors that don't use the normalized
    // excelReader API (cashFlow, profitLossForm2 work on raw xlsx rows
    // directly via getCellValue(rowIdx, colIdx) or row[colIdx] arrays).
    findCodeColumnByDensityCb,
    sampleHeaderRegionCb,
    throwDiagnosticErrorCb
};
