import {
  eachCellInRow,
  getCell,
  type NormalizedCell,
  type NormalizedSheet,
} from '../../readers/excel-reader';

/**
 * Defensive helpers shared by every NSBU extractor. Two purposes:
 *
 *   1. Fallback heuristics — when primary token-based detection fails (e.g.
 *      a new NSBU format variant uses different header text), structural /
 *      statistical detection (e.g. column density of 3-digit codes) keeps
 *      extraction running.
 *
 *   2. Diagnostic errors — when even fallbacks fail, attach structured info
 *      (row counts, sampled cells, searched tokens) to the thrown error so
 *      ops can triage from logs without re-running locally.
 *
 * Ported from backend/src/processors/extractors/_common/structureDiagnostics.js
 * with behavior preserved exactly. The "callback-based" variants are kept for
 * extractors (cashFlow, profitLossForm2) that work on raw xlsx rows rather
 * than the normalized sheet API.
 */

const ZERO_WIDTH_RE = new RegExp('[\\u200B-\\u200D\\uFEFF]', 'g');

export function normalizeText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).toLowerCase().replace(ZERO_WIDTH_RE, '').replace(/\s+/g, ' ').trim();
}

export function cellToText(cell: unknown): string {
  if (cell === null || cell === undefined) return '';
  if (typeof cell === 'string') return cell;
  if (typeof cell === 'number') return String(cell);
  if (cell instanceof Date) return cell.toISOString();
  if (typeof cell === 'object') {
    const o = cell as {
      text?: unknown;
      value?: unknown;
      richText?: Array<{ text?: string }>;
      result?: unknown;
      formula?: unknown;
    };
    if (typeof o.text === 'string') return o.text;
    if (typeof o.value === 'string') return o.value;
    if (typeof o.value === 'number') return String(o.value);
    if (Array.isArray(o.richText)) return o.richText.map((r) => r.text || '').join('');
    if (o.result !== undefined) return String(o.result);
    if (o.formula) return '';
  }
  return String(cell);
}

export function looksLikeNsbuCode(text: unknown): boolean {
  const t = normalizeText(text);
  if (!/^0*\d{1,4}$/.test(t)) return false;
  const n = parseInt(t, 10);
  return n >= 10 && n <= 9999;
}

export interface CodeColumnResult {
  column: number;
  hits: number;
  scannedRows: number;
}

export function findCodeColumnByDensity(
  sheet: NormalizedSheet,
  opts: { scanRows?: number; minHits?: number; maxColumn?: number } = {},
): CodeColumnResult | null {
  const scanRows = Math.min(sheet.rowCount || 0, opts.scanRows ?? 200);
  const minHits = opts.minHits ?? 5;
  const maxColumn = opts.maxColumn ?? 15;
  if (scanRows === 0) return null;

  const hitsByColumn = new Map<number, number>();

  for (let rowNum = 1; rowNum <= scanRows; rowNum++) {
    eachCellInRow(sheet, rowNum, (cell: NormalizedCell, colNum: number) => {
      if (colNum > maxColumn) return;
      if (looksLikeNsbuCode(cellToText(cell.value))) {
        hitsByColumn.set(colNum, (hitsByColumn.get(colNum) ?? 0) + 1);
      }
    });
  }

  if (hitsByColumn.size === 0) return null;

  let bestColumn: number | null = null;
  let bestHits = 0;
  for (const [colNum, hits] of hitsByColumn) {
    if (
      hits > bestHits ||
      (hits === bestHits && (bestColumn === null || colNum < bestColumn))
    ) {
      bestColumn = colNum;
      bestHits = hits;
    }
  }

  if (bestColumn === null || bestHits < minHits) return null;
  return { column: bestColumn, hits: bestHits, scannedRows: scanRows };
}

export function findDataStartRow(
  sheet: NormalizedSheet,
  codeColumn: number,
  opts: { scanRows?: number } = {},
): number | null {
  const scanRows = Math.min(sheet.rowCount || 0, opts.scanRows ?? 300);
  for (let rowNum = 1; rowNum <= scanRows; rowNum++) {
    const cell = getCell(sheet, rowNum, codeColumn);
    if (cell && looksLikeNsbuCode(cellToText(cell.value))) return rowNum;
  }
  return null;
}

export function findNameColumnByTextDensity(
  sheet: NormalizedSheet,
  dataStartRow: number,
  opts: { scanRows?: number; maxColumn?: number } = {},
): number | null {
  const scanRows = Math.min(sheet.rowCount || 0, dataStartRow + (opts.scanRows ?? 80));
  const maxColumn = opts.maxColumn ?? 15;
  const stats = new Map<number, { totalLen: number; count: number }>();

  for (let rowNum = dataStartRow; rowNum <= scanRows; rowNum++) {
    eachCellInRow(sheet, rowNum, (cell, colNum) => {
      if (colNum > maxColumn) return;
      const text = cellToText(cell.value).trim();
      if (!text || /^[\d\s.,\-()]+$/.test(text)) return;
      if (looksLikeNsbuCode(text)) return;
      if (text.length < 4) return;
      const cur = stats.get(colNum) ?? { totalLen: 0, count: 0 };
      cur.totalLen += text.length;
      cur.count += 1;
      stats.set(colNum, cur);
    });
  }

  if (stats.size === 0) return null;

  let bestColumn: number | null = null;
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

export interface HeaderCellSample {
  row: number;
  col: number;
  text: string;
}

export function sampleHeaderRegion(
  sheet: NormalizedSheet,
  opts: { scanRows?: number; maxColumn?: number; max?: number } = {},
): HeaderCellSample[] {
  const scanRows = Math.min(sheet.rowCount || 0, opts.scanRows ?? 20);
  const maxColumn = opts.maxColumn ?? 12;
  const max = opts.max ?? 80;
  const out: HeaderCellSample[] = [];
  for (let rowNum = 1; rowNum <= scanRows && out.length < max; rowNum++) {
    eachCellInRow(sheet, rowNum, (cell, colNum) => {
      if (colNum > maxColumn || out.length >= max) return;
      const text = cellToText(cell.value).trim();
      if (!text) return;
      const truncated = text.length > 60 ? text.slice(0, 57) + '...' : text;
      out.push({ row: rowNum, col: colNum, text: truncated });
    });
  }
  return out;
}

export interface DiagnosticInfo {
  searchedFor?: string[];
  headerSample?: HeaderCellSample[];
  extra?: unknown;
}

export class DiagnosticError extends Error {
  diagnostic: DiagnosticInfo & {
    reportType: string;
    what: string;
    rowCount: number;
    columnCount?: number;
  };
  constructor(
    message: string,
    diagnostic: DiagnosticInfo & {
      reportType: string;
      what: string;
      rowCount: number;
      columnCount?: number;
    },
  ) {
    super(message);
    this.name = 'DiagnosticError';
    this.diagnostic = diagnostic;
  }
}

export function throwDiagnosticError(
  reportType: string,
  what: string,
  sheet: NormalizedSheet,
  details: DiagnosticInfo = {},
): never {
  const searched = (details.searchedFor || []).join(', ') || '(no specific tokens)';
  const headerSample = details.headerSample || sampleHeaderRegion(sheet);
  const sampleStr = headerSample
    .slice(0, 20)
    .map((c) => `  R${c.row}C${c.col}: "${c.text}"`)
    .join('\n');
  const extra = details.extra ? '\nAdditional context: ' + JSON.stringify(details.extra) : '';

  throw new DiagnosticError(
    `[${reportType}] Could not find ${what}.\n` +
      `Searched for tokens: ${searched}\n` +
      `Sheet has ${sheet.rowCount || 0} rows, ${sheet.columnCount || '?'} columns.\n` +
      `Top non-empty cells:\n${sampleStr || '  (none found)'}` +
      extra,
    {
      reportType,
      what,
      searchedFor: details.searchedFor || [],
      headerSample,
      rowCount: sheet.rowCount || 0,
      columnCount: sheet.columnCount,
      extra: details.extra,
    },
  );
}

// ─── Callback-based variants ──────────────────────────────────────────────────
// Used by cashFlow / profitLossForm2 extractors that work on raw xlsx rows
// directly. Row/col are 0-based here (matching xlsx convention).

export type GetCellValue = (row: number, col: number) => unknown;

export function findCodeColumnByDensityCb(
  getCellValue: GetCellValue,
  rowCount: number,
  opts: { scanRows?: number; minHits?: number; maxColumn?: number } = {},
): CodeColumnResult | null {
  const scanRows = Math.min(rowCount || 0, opts.scanRows ?? 200);
  const minHits = opts.minHits ?? 5;
  const maxColumn = opts.maxColumn ?? 15;
  if (scanRows === 0) return null;

  const hitsByColumn = new Map<number, number>();

  for (let r = 0; r < scanRows; r++) {
    for (let c = 0; c < maxColumn; c++) {
      const v = getCellValue(r, c);
      if (v === null || v === undefined) continue;
      if (looksLikeNsbuCode(cellToText(v))) {
        hitsByColumn.set(c, (hitsByColumn.get(c) ?? 0) + 1);
      }
    }
  }

  if (hitsByColumn.size === 0) return null;

  let bestColumn: number | null = null;
  let bestHits = 0;
  for (const [colIdx, hits] of hitsByColumn) {
    if (
      hits > bestHits ||
      (hits === bestHits && (bestColumn === null || colIdx < bestColumn))
    ) {
      bestColumn = colIdx;
      bestHits = hits;
    }
  }

  if (bestColumn === null || bestHits < minHits) return null;
  return { column: bestColumn, hits: bestHits, scannedRows: scanRows };
}

export function sampleHeaderRegionCb(
  getCellValue: GetCellValue,
  rowCount: number,
  opts: { scanRows?: number; maxColumn?: number; max?: number } = {},
): HeaderCellSample[] {
  const scanRows = Math.min(rowCount || 0, opts.scanRows ?? 20);
  const maxColumn = opts.maxColumn ?? 12;
  const max = opts.max ?? 80;
  const out: HeaderCellSample[] = [];
  for (let r = 0; r < scanRows && out.length < max; r++) {
    for (let c = 0; c < maxColumn && out.length < max; c++) {
      const v = getCellValue(r, c);
      if (v === null || v === undefined) continue;
      const text = cellToText(v).trim();
      if (!text) continue;
      const truncated = text.length > 60 ? text.slice(0, 57) + '...' : text;
      // 1-based for human-readable error messages.
      out.push({ row: r + 1, col: c + 1, text: truncated });
    }
  }
  return out;
}

export function throwDiagnosticErrorCb(
  reportType: string,
  what: string,
  getCellValue: GetCellValue,
  rowCount: number,
  columnCount: number | undefined,
  details: DiagnosticInfo = {},
): never {
  const searched = (details.searchedFor || []).join(', ') || '(no specific tokens)';
  const headerSample = details.headerSample || sampleHeaderRegionCb(getCellValue, rowCount);
  const sampleStr = headerSample
    .slice(0, 20)
    .map((c) => `  R${c.row}C${c.col}: "${c.text}"`)
    .join('\n');
  const extra = details.extra ? '\nAdditional context: ' + JSON.stringify(details.extra) : '';

  throw new DiagnosticError(
    `[${reportType}] Could not find ${what}.\n` +
      `Searched for tokens: ${searched}\n` +
      `Sheet has ${rowCount || 0} rows, ${columnCount || '?'} columns.\n` +
      `Top non-empty cells:\n${sampleStr || '  (none found)'}` +
      extra,
    {
      reportType,
      what,
      searchedFor: details.searchedFor || [],
      headerSample,
      rowCount: rowCount || 0,
      columnCount,
      extra: details.extra,
    },
  );
}
