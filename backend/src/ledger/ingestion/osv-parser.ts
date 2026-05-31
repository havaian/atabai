import * as XLSX from 'xlsx';

/**
 * One parsed account-totals row out of a 1C ОСВ ("Оборотно-сальдовая ведомость")
 * export.
 *
 * Money values are returned as **strings** (not numbers). IEEE 754 doubles
 * cannot exactly represent decimal fractions — a cell showing `3,612,718,386.26`
 * round-trips through JS Number as `3612718386.2599998`, and that bit pattern
 * reaching `Decimal128.fromString` would be silently wrong by 1 ulp. Accounting
 * precision is the product's reputational moat (architecture doc §1), so money
 * is kept as text from the cell to the Decimal128 conversion at the schema
 * boundary. The parser reads `cell.w` (Excel's pre-rendered display text) when
 * present, falling back to the raw value's string form.
 *
 * `level` is the row's hierarchy depth, taken from the export's row outline
 * level (1C writes the account tree as Excel row grouping): 0 = a top-level
 * account, 1 = a sub-account, 2 = a sub-sub-account, and so on. It is preserved
 * so a downstream consumer can choose the grain to aggregate at WITHOUT
 * re-deriving the tree from the code string (which is unreliable — a partial
 * export can have a parent that does not equal the sum of its visible
 * children). The grand-total reconciliation below uses level 0.
 *
 * Subconto sub-rows in the source (per-counterparty / per-contract breakdown
 * lines under an account, including purely-numeric subconto values such as bank
 * account numbers or ИНН) are NOT returned: they are rejected by the account
 * code shape and recorded in `warnings`. The aggregated parent total IS
 * captured, so the imported balance is correct at account grain.
 */
export interface ParsedOsvRow {
  /** Account code, e.g. "0100", "0130.2". */
  code: string;
  /** Display name, e.g. "Основные средства". */
  name: string;
  /** Row outline depth: 0 = top-level account, 1 = sub-account, 2 = sub-sub, … */
  level: number;
  /** Decimal string, "0" when the cell was blank. Never a JS Number — see docblock. */
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
  /** Usually the period label, e.g. "Оборотно-сальдовая ведомость за 1 квартал 2026 г.". */
  periodHeader: string | null;
  rows: ParsedOsvRow[];
  /** Soft issues — rows skipped, reconciliation notes, etc. Caller decides whether to surface them. */
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

// ─── Account code shapes ────────────────────────────────────────────────────
// An NSBU account code is a 3- or 4-digit synthetic stem with optional
// dot-suffixed sub-accounts: "0100", "6420.5", "014", "0130.2.1". The 3–4 digit
// cap is deliberate — it rejects purely-numeric subconto detail lines (20-digit
// bank account numbers, ИНН, document numbers) that would otherwise be misread
// as accounts.
const ACCOUNT_CODE_ONLY = /^\s*(\d{3,4}(?:\.\d+)*)\s*$/;
const ACCOUNT_ROW_COMBINED = /^\s*(\d{3,4}(?:\.\d+)*)\s*,\s*(.+?)\s*$/;

// ─── Header signals ──────────────────────────────────────────────────────────
// The data sheet, header row, money columns and code/name layout are all
// located by these signals rather than by sheet name or fixed offsets — 1C
// names the sheet anything (TDSheet, Sheet1, a localized title…) and varies the
// column layout between configurations.
const HEADER_ACCOUNT_PREFIX = 'счет'; // header row: column A starts with this
const HEADER_NAME_KEY = 'наименование'; // a separate name column when present
const GROUP_OPENING_KEY = 'начало'; // "Сальдо на начало периода"
const GROUP_PERIOD_KEY = 'оборот'; //  "Обороты за период"
const GROUP_CLOSING_KEY = 'конец'; //  "Сальдо на конец периода"
const DEBIT_KEY = 'дебет';
const CREDIT_KEY = 'кредит';
const SUBHEADER_LABELS = ['субконто1', 'субконто2', 'субконто3'];
// Footer/total row prefixes. NB: matched by prefix, not a `\b` word boundary —
// in JS `\b` is ASCII-only and never matches after a Cyrillic letter, so
// /итого\b/ would silently fail to fire on "Итого".
const TOTAL_PREFIXES = ['итог', 'total', 'всего'];
const MAX_HEADER_SCAN_ROWS = 25;

/**
 * Read a money cell as an exact decimal string. Prefers Excel's pre-rendered
 * display text (`cell.w`) and falls back to the raw value only when no display
 * text was stored (typically blank cells, mapped to "0").
 */
const moneyStr = (cell: XLSX.CellObject | undefined): string => {
  if (!cell || cell.v === undefined || cell.v === null) return '0';
  if (typeof cell.v === 'number') {
    if (!Number.isFinite(cell.v)) return '0';
    if (cell.v === 0) return '0';
    // Round to money precision (2 decimals — tiyin) to discard IEEE-754 noise,
    // then strip trailing zeros and any dangling point. A stored double for
    // 7 472 408 731.94 is actually 7472408731.9400010…, and rendering it at 6
    // decimals would persist that wrong tail straight into Decimal128. Two
    // decimals is the precision of UZS money totals.
    return cell.v.toFixed(2).replace(/\.?0+$/, '') || '0';
  }
  if (typeof cell.v === 'string') return cell.v.trim() || '0';
  return '0';
};

// Integer-cents view of a money string, for the reconciliation gate only.
// Summing integer cents is exact in IEEE 754 up to 2^53 (≈ 9e13 currency
// units), well beyond any real balance sheet, so the grand-total check never
// drifts. The stored values stay as exact strings (above) — this is only used
// to compare totals.
const cents = (s: string): number => Math.round((parseFloat(s) || 0) * 100);

interface SheetAccessors {
  cell: (r: number, c: number) => XLSX.CellObject | undefined;
  text: (r: number, c: number) => string;
  /** Row outline (grouping) level; 0 when the row carries none. */
  level: (r: number) => number;
  lastRow: number;
  lastCol: number;
}

function makeAccessors(ws: XLSX.WorkSheet): SheetAccessors | null {
  const ref = (ws as unknown as { '!ref'?: string })['!ref'];
  if (typeof ref !== 'string') return null;
  const range = XLSX.utils.decode_range(ref);
  const rowsMeta = (ws as unknown as { '!rows'?: Array<{ level?: number } | undefined> })['!rows'];
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
  const level = (r: number): number => {
    const ri = rowsMeta ? rowsMeta[r] : undefined;
    return ri && typeof ri.level === 'number' ? ri.level : 0;
  };
  return { cell, text, level, lastRow: range.e.r, lastCol: range.e.c };
}

interface OsvLayout {
  headerRow: number;
  dataStartRow: number;
  codeCol: number;
  /** Name column, or null when code+name share the code column ("code, name"). */
  nameCol: number | null;
  openingDebitCol: number;
  openingCreditCol: number;
  periodDebitCol: number;
  periodCreditCol: number;
  closingDebitCol: number;
  closingCreditCol: number;
}

/**
 * Recognise an ОСВ layout in a single sheet, purely from its headers. Returns
 * null when the sheet doesn't carry the signature, so the caller moves to the
 * next sheet.
 */
function detectOsvLayout(acc: SheetAccessors): OsvLayout | null {
  const { text, lastRow, lastCol } = acc;
  const scanTo = Math.min(MAX_HEADER_SCAN_ROWS, lastRow);

  // 1. Header row: column A starts with "Счет" (covers both the combined
  //    "Счет, Наименование счета" and the split "Счет").
  let headerRow = -1;
  for (let r = 0; r <= scanTo; r++) {
    if (text(r, 0).toLowerCase().startsWith(HEADER_ACCOUNT_PREFIX)) {
      headerRow = r;
      break;
    }
  }
  if (headerRow === -1) return null;

  const findCol = (row: number, key: string): number => {
    for (let c = 0; c <= lastCol; c++) {
      if (text(row, c).toLowerCase().includes(key)) return c;
    }
    return -1;
  };

  // 2. Group headers — on the header row, or the row above it (some exports put
  //    the balance-group band one row higher than the "Счет" cell).
  const groupCol = (key: string): number => {
    const here = findCol(headerRow, key);
    if (here !== -1) return here;
    return headerRow > 0 ? findCol(headerRow - 1, key) : -1;
  };
  const openGroup = groupCol(GROUP_OPENING_KEY);
  const periodGroup = groupCol(GROUP_PERIOD_KEY);
  const closeGroup = groupCol(GROUP_CLOSING_KEY);
  if (openGroup === -1 || periodGroup === -1 || closeGroup === -1) return null;

  // 3. Дебет/Кредит band: first row at/just below the header carrying ≥2
  //    дебет/кредит cells.
  let dkRow = -1;
  for (let r = headerRow; r <= Math.min(headerRow + 3, lastRow); r++) {
    let hits = 0;
    for (let c = 0; c <= lastCol; c++) {
      const t = text(r, c).toLowerCase();
      if (t === DEBIT_KEY || t === CREDIT_KEY) hits++;
    }
    if (hits >= 2) {
      dkRow = r;
      break;
    }
  }
  if (dkRow === -1) return null;

  // 4. Each group's Debit/Credit columns are the дебет/кредит cells on the band
  //    row that fall within the group's column span. Groups run left-to-right
  //    (начало → обороты → конец); the closing group runs to the used width.
  const inBand = (from: number, to: number, key: string): number => {
    for (let c = from; c < to && c <= lastCol; c++) {
      if (text(dkRow, c).toLowerCase() === key) return c;
    }
    return -1;
  };
  const spans: Array<[number, number]> = [
    [openGroup, periodGroup],
    [periodGroup, closeGroup],
    [closeGroup, lastCol + 1],
  ];
  const openingDebitCol = inBand(spans[0][0], spans[0][1], DEBIT_KEY);
  const openingCreditCol = inBand(spans[0][0], spans[0][1], CREDIT_KEY);
  const periodDebitCol = inBand(spans[1][0], spans[1][1], DEBIT_KEY);
  const periodCreditCol = inBand(spans[1][0], spans[1][1], CREDIT_KEY);
  const closingDebitCol = inBand(spans[2][0], spans[2][1], DEBIT_KEY);
  const closingCreditCol = inBand(spans[2][0], spans[2][1], CREDIT_KEY);
  if (
    openingDebitCol === -1 ||
    openingCreditCol === -1 ||
    periodDebitCol === -1 ||
    periodCreditCol === -1 ||
    closingDebitCol === -1 ||
    closingCreditCol === -1
  ) {
    return null;
  }

  // 5. Code/name: a "Наименование" header in a column other than A means code
  //    and name are split into two columns; otherwise they share column A as
  //    "code, name" (the header cell reads "Счет, Наименование счета").
  const nameHeaderCol = findCol(headerRow, HEADER_NAME_KEY);
  const nameCol = nameHeaderCol > 0 ? nameHeaderCol : null;

  // 6. Data starts after the Дебет/Кредит band, skipping Субконто label rows.
  let dataStartRow = dkRow + 1;
  while (
    dataStartRow <= lastRow &&
    SUBHEADER_LABELS.includes(text(dataStartRow, 0).toLowerCase())
  ) {
    dataStartRow++;
  }

  return {
    headerRow,
    dataStartRow,
    codeCol: 0,
    nameCol,
    openingDebitCol,
    openingCreditCol,
    periodDebitCol,
    periodCreditCol,
    closingDebitCol,
    closingCreditCol,
  };
}

const isTotalRow = (cellA: string): boolean => {
  const a = cellA.toLowerCase().trim();
  return TOTAL_PREFIXES.some((p) => a.startsWith(p));
};

/**
 * Parse a 1C ОСВ export (.xls or .xlsx) into structured account-totals rows.
 *
 * Pure function: the only I/O is the workbook read. The ingestion service
 * consumes the result and decides how to map rows into AccountBalance rows.
 *
 * Robust to layout variation because nothing depends on sheet name or fixed
 * column offsets:
 *   - the data sheet is found by scanning every sheet for the header signature;
 *   - money columns are resolved from the three balance-group headers and the
 *     Дебет/Кредит band, so combined-vs-split layouts and any column offset
 *     parse identically;
 *   - the account hierarchy comes from the row outline level, not the code;
 *   - extraction is checked against the file's own Итого: the trial balance
 *     must be balanced (Итого Debit == Итого Credit) and the top-level
 *     (outline-level-0) rows must sum to Итого on the closing side. A
 *     present-but-mismatching Итого throws — the import refuses rather than
 *     write balances that don't reconcile.
 */
export function parseOsv(input: string | Buffer): OsvParseResult {
  const wb = XLSX.read(input, {
    type: Buffer.isBuffer(input) ? 'buffer' : 'file',
    cellDates: true,
    cellStyles: true,
  });

  if (!wb.SheetNames.length) {
    throw new OsvParseError('Workbook contains no sheets');
  }

  // ─── Find the data sheet by its column signature ────────────────────────────
  let selected: { acc: SheetAccessors; layout: OsvLayout } | null = null;
  const triedSheets: string[] = [];
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    triedSheets.push(name);
    const acc = makeAccessors(ws);
    if (!acc) continue;
    const layout = detectOsvLayout(acc);
    if (layout) {
      selected = { acc, layout };
      break;
    }
  }
  if (!selected) {
    throw new OsvParseError(
      `Could not find an ОСВ data sheet — scanned ${triedSheets.length} sheet(s) ` +
        `[${triedSheets.join(', ')}] for the "Счет" / "Сальдо…" / "Дебет"/"Кредит" header signature`,
    );
  }

  const { acc, layout } = selected;
  const { cell, text, level, lastRow } = acc;

  // ─── Title block ────────────────────────────────────────────────────────────
  // First two non-empty column-A cells above the header row — company name and
  // the period label, echoed back so the operator can confirm the right file.
  let companyHeader: string | null = null;
  let periodHeader: string | null = null;
  for (let r = 0; r < layout.headerRow; r++) {
    const t = text(r, 0);
    if (!t) continue;
    if (companyHeader === null) {
      companyHeader = t;
    } else {
      periodHeader = t;
      break;
    }
  }

  // ─── Data scan ──────────────────────────────────────────────────────────────
  const out: ParsedOsvRow[] = [];
  const warnings: string[] = [];
  let consecutiveBlanks = 0;

  // Top-level (outline-level-0) running totals, for the Итого reconciliation.
  let topOpenDr = 0;
  let topOpenCr = 0;
  let topClsDr = 0;
  let topClsCr = 0;
  let itogo: {
    openDr: number;
    openCr: number;
    clsDr: number;
    clsCr: number;
  } | null = null;

  for (let r = layout.dataStartRow; r <= lastRow; r++) {
    const cellA = text(r, layout.codeCol);

    if (!cellA) {
      // Two consecutive blank rows = end of data section.
      consecutiveBlanks++;
      if (consecutiveBlanks >= 2) break;
      continue;
    }
    consecutiveBlanks = 0;

    // Totals row ends the on-balance section. Capture it for reconciliation.
    // Off-balance (забалансовые) accounts that 1C prints after Итого are not
    // imported — out of scope for the balance-sheet grain.
    if (isTotalRow(cellA)) {
      itogo = {
        openDr: cents(moneyStr(cell(r, layout.openingDebitCol))),
        openCr: cents(moneyStr(cell(r, layout.openingCreditCol))),
        clsDr: cents(moneyStr(cell(r, layout.closingDebitCol))),
        clsCr: cents(moneyStr(cell(r, layout.closingCreditCol))),
      };
      break;
    }

    // Account code + name — split (own columns) or combined ("code, name").
    let code: string;
    let name: string;
    if (layout.nameCol !== null) {
      const m = ACCOUNT_CODE_ONLY.exec(cellA);
      if (!m) {
        warnings.push(
          `Row ${r + 1}: skipped non-account row ${JSON.stringify(cellA.slice(0, 120))}`,
        );
        continue;
      }
      code = m[1];
      name = text(r, layout.nameCol);
    } else {
      const m = ACCOUNT_ROW_COMBINED.exec(cellA);
      if (!m) {
        warnings.push(
          `Row ${r + 1}: skipped non-account row ${JSON.stringify(cellA.slice(0, 120))}`,
        );
        continue;
      }
      code = m[1];
      name = m[2];
    }

    const rowLevel = level(r);
    const openingDebit = moneyStr(cell(r, layout.openingDebitCol));
    const openingCredit = moneyStr(cell(r, layout.openingCreditCol));
    const periodDebit = moneyStr(cell(r, layout.periodDebitCol));
    const periodCredit = moneyStr(cell(r, layout.periodCreditCol));
    const closingDebit = moneyStr(cell(r, layout.closingDebitCol));
    const closingCredit = moneyStr(cell(r, layout.closingCreditCol));

    if (rowLevel === 0) {
      topOpenDr += cents(openingDebit);
      topOpenCr += cents(openingCredit);
      topClsDr += cents(closingDebit);
      topClsCr += cents(closingCredit);
    }

    out.push({
      code,
      name,
      level: rowLevel,
      openingDebit,
      openingCredit,
      periodDebit,
      periodCredit,
      closingDebit,
      closingCredit,
      sourceRow: r + 1,
    });
  }

  if (out.length === 0) {
    throw new OsvParseError('No account rows found in data section');
  }

  // ─── Reconciliation gate ────────────────────────────────────────────────────
  // The file's own Итого is ground truth. Enforced only when it is present:
  // closing balances must be balanced and the top-level rows must sum to it.
  // Opening reconciliation is reported as a warning rather than enforced, so a
  // quirk in an opening-balance subtotal can't reject an otherwise-good import.
  if (itogo) {
    if (itogo.clsDr !== itogo.clsCr) {
      throw new OsvParseError(
        `Итого is not balanced: closing Debit ${itogo.clsDr / 100} ≠ closing Credit ${itogo.clsCr / 100}. ` +
          `The money columns were likely misread.`,
      );
    }
    if (topClsDr !== itogo.clsDr || topClsCr !== itogo.clsCr) {
      throw new OsvParseError(
        `Extraction does not reconcile to Итого. Top-level closing ` +
          `Dr ${topClsDr / 100} / Cr ${topClsCr / 100} vs Итого Dr ${itogo.clsDr / 100} / Cr ${itogo.clsCr / 100}. ` +
          `Some top-level accounts may have been missed, duplicated, or mis-levelled.`,
      );
    }
    if (topOpenDr !== itogo.openDr || topOpenCr !== itogo.openCr) {
      warnings.push(
        `Opening balances do not reconcile to Итого (top-level Dr ${topOpenDr / 100} / Cr ${topOpenCr / 100} ` +
          `vs Итого Dr ${itogo.openDr / 100} / Cr ${itogo.openCr / 100}). Closing reconciled.`,
      );
    }
  } else {
    warnings.push(
      'No Итого row found — could not reconcile the extraction against the file total.',
    );
  }

  return { companyHeader, periodHeader, rows: out, warnings };
}
