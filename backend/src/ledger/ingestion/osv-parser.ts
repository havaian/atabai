import * as XLSX from 'xlsx';

/**
 * One parsed account-totals row out of a 1C ОСВ ("Оборотно-сальдовая ведомость")
 * TDSheet export.
 *
 * Money values are returned as **strings** (not numbers). IEEE 754 doubles
 * cannot exactly represent decimal fractions — a cell showing `3,612,718,386.26`
 * round-trips through JS Number as `3612718386.2599998`, and that bit pattern
 * reaching `Decimal128.fromString` would be silently wrong by 1 ulp. Accounting
 * precision is the product's reputational moat (architecture doc §1), so we
 * keep money as text from the cell to the Decimal128 conversion at the schema
 * boundary. The parser reads `cell.w` (Excel's pre-rendered display text)
 * when present, falling back to the raw value's string form.
 *
 * Subconto sub-rows in the source (lines indented under an account showing
 * per-counterparty breakdown) are NOT returned here in this revision — they
 * appear in `warnings` instead. The aggregated parent total IS captured, so
 * the imported balance is correct at account-level grain. Subconto-aware
 * ingestion is a follow-up once we have a real example file that exercises
 * the counterparty axis (the analyst's `осв пример.xls` does not).
 */
export interface ParsedOsvRow {
  /** Account code, e.g. "0100", "0130.2". */
  code: string;
  /** Display name, e.g. "Основные средства". */
  name: string;
  /** Decimal string, "0" when the cell was blank. Never a JS Number — see interface docblock. */
  openingDebit: string;
  openingCredit: string;
  periodDebit: string;
  periodCredit: string;
  closingDebit: string;
  closingCredit: string;
  /** 1-indexed source row, for error messages. */
  sourceRow: number;
}

export interface OsvParseResult {
  /** Cell A1 — usually the legal name of the company; null if missing. */
  companyHeader: string | null;
  /** Row 2 — usually the period label, e.g. "Оборотно-сальдовая ведомость за 1 квартал 2026 г.". */
  periodHeader: string | null;
  rows: ParsedOsvRow[];
  /** Soft issues — rows skipped, ambiguous values, etc. Caller decides whether to surface them. */
  warnings: string[];
}

export class OsvParseError extends Error {
  constructor(
    message: string,
    public readonly sourceRow?: number,
  ) {
    super(message);
    this.name = 'OsvParseError';
  }
}

// Matches "0100, Основные средства" or "0130.2, Рабочие машины и оборудование".
// Allows multi-segment dot codes ("0130.2.1") and tolerates surrounding whitespace.
const ACCOUNT_ROW = /^\s*(\d+(?:\.\d+)*)\s*,\s*(.+?)\s*$/;

// Header sentinels — the parser locates the data section by these.
const HEADER_CELL_A = 'Счет, Наименование счета';
const SUBHEADER_CELL_A_OPTIONS = ['Субконто1', 'Субконто2', 'Субконто3'];

const TARGET_SHEET_NAME = 'TDSheet';

/**
 * Read a money cell as an exact decimal string. Prefers Excel's pre-rendered
 * display text (`cell.w`, which honors the cell's number format and so reflects
 * the operator's intended precision) and falls back to the cell's raw value
 * only when no display text was stored. The fallback path is the only one
 * exposed to IEEE 754 round-tripping — it fires for cells that XLSX read
 * without invoking the formatter, typically blank cells (`null`) which we
 * map to `"0"` anyway.
 */
const moneyStr = (cell: XLSX.CellObject | undefined): string => {
  if (!cell || cell.v === undefined || cell.v === null) return '0';
  if (typeof cell.v === 'number') {
    if (!Number.isFinite(cell.v)) return '0';
    // toFixed(6) → "15450000.000000". The regex below strips trailing zeros
    // and a dangling decimal point: "15450000.000000" → "15450000".
    return cell.v.toFixed(6).replace(/\.?0+$/, '');
  }
  if (typeof cell.v === 'string') return cell.v.trim() || '0';
  return '0';
};


const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/**
 * Parse a 1C ОСВ export (.xls or .xlsx) into structured account-totals rows.
 *
 * Designed to be a pure function: no I/O beyond the workbook read, no
 * database access, no logging. The ingestion service consumes the result
 * and decides how to map it into AccountBalance rows for an org+period.
 *
 * The 1C "УЗ" format ships everything in a single sheet named TDSheet —
 * shared with `Chart of accounts.xlsx`. Other 1C variants surface the
 * sheet under a different name; the heuristic sheet scorer in
 * `processors/readers/excel-reader.ts` is the long-term home for that
 * disambiguation. For now this parser hard-pins TDSheet and falls back to
 * the first sheet if it's missing.
 *
 * Column layout (anchored by row 6 sub-header "Дебет/Кредит"):
 *   col 0 (A)  account "{code}, {name}"
 *   col 1 (B)  spacer
 *   col 2 (C)  opening Debit          ┐
 *   col 3 (D)  opening Credit         │ Сальдо на начало периода
 *   col 4 (E)  period Debit           ┐
 *   col 5 (F)  period Credit          │ Обороты за период
 *   col 6 (G)  spacer
 *   col 7 (H)  closing Debit          ┐
 *   col 8 (I)  closing Credit         │ Сальдо на конец периода
 */
export function parseOsv(input: string | Buffer): OsvParseResult {
  const wb = XLSX.read(input, {
    type: Buffer.isBuffer(input) ? 'buffer' : 'file',
    cellDates: true,
  });

  const sheetName = wb.SheetNames.includes(TARGET_SHEET_NAME)
    ? TARGET_SHEET_NAME
    : wb.SheetNames[0];
  if (!sheetName) throw new OsvParseError('Workbook contains no sheets');

  const ws = wb.Sheets[sheetName];
  if (!ws || !ws['!ref']) {
    throw new OsvParseError('Sheet is empty or has no range');
  }

  const range = XLSX.utils.decode_range(ws['!ref']);
  const lastRow = range.e.r; // 0-indexed inclusive

  // Cell accessors — return CellObject (which carries both .v and .w) so the
  // moneyStr helper can prefer formatted text.
  const cell = (r: number, c: number): XLSX.CellObject | undefined =>
    ws[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject | undefined;
  const text = (r: number, c: number): string => {
    const x = cell(r, c);
    if (!x) return '';
    if (typeof x.w === 'string') return x.w.trim();
    if (typeof x.v === 'string') return x.v.trim();
    if (typeof x.v === 'number') return String(x.v);
    return '';
  };

  // ─── Header section ───────────────────────────────────────────────────────
  const companyHeader = text(0, 0) || null;
  const periodHeader = text(1, 0) || null;

  // ─── Locate the data-section anchor ───────────────────────────────────────
  // The header row carries "Счет, Наименование счета" in column A. We scan
  // the first 20 rows to find it rather than hardcoding row 5, because
  // 1C exports vary in title-block height between configurations.
  let headerRowIdx = -1;
  for (let r = 0; r <= Math.min(20, lastRow); r++) {
    if (text(r, 0) === HEADER_CELL_A) {
      headerRowIdx = r;
      break;
    }
  }
  if (headerRowIdx === -1) {
    throw new OsvParseError(
      `Could not locate header row (looking for "${HEADER_CELL_A}" in column A within the first 20 rows)`,
    );
  }

  // The two rows after the header are typically Субконто1 / Субконто2 labels.
  // We skip past whichever of those are present and start scanning data at
  // the next non-labeled row.
  let cursor = headerRowIdx + 1;
  while (
    cursor <= lastRow &&
    SUBHEADER_CELL_A_OPTIONS.includes(text(cursor, 0))
  ) {
    cursor++;
  }

  // ─── Data scan ────────────────────────────────────────────────────────────
  const out: ParsedOsvRow[] = [];
  const warnings: string[] = [];
  let consecutiveBlanks = 0;

  for (let r = cursor; r <= lastRow; r++) {
    const cellA = text(r, 0);

    if (!cellA) {
      // Two consecutive blank rows = end of data section.
      consecutiveBlanks++;
      if (consecutiveBlanks >= 2) break;
      continue;
    }
    consecutiveBlanks = 0;

    // Footer rows: "Итого", "Total", etc. Stop scanning rather than risking
    // a misparse of a totals row as an account.
    if (/^\s*(итого|total|всего)\b/i.test(cellA)) break;

    const match = ACCOUNT_ROW.exec(cellA);
    if (!match) {
      // Subconto sub-rows ("Контрагенты: X", "Договор Y", etc.) and other
      // non-account rows land here. Recorded as a warning so the caller can
      // surface them in the import UI without us silently dropping data.
      warnings.push(
        `Row ${r + 1}: skipped non-account row ${JSON.stringify(cellA.slice(0, 120))}`,
      );
      continue;
    }

    const [, code, name] = match;
    out.push({
      code,
      name,
      openingDebit: moneyStr(cell(r, 2)),
      openingCredit: moneyStr(cell(r, 3)),
      periodDebit: moneyStr(cell(r, 4)),
      periodCredit: moneyStr(cell(r, 5)),
      closingDebit: moneyStr(cell(r, 7)),
      closingCredit: moneyStr(cell(r, 8)),
      sourceRow: r + 1,
    });
  }

  if (out.length === 0) {
    throw new OsvParseError('No account rows found in data section');
  }

  return { companyHeader, periodHeader, rows: out, warnings };
}
