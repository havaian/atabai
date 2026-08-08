import * as XLSX from 'xlsx';

/**
 * One parsed row out of a bank-statement Excel export.
 *
 * Money values are decimal strings - same precision discipline as the OSV
 * parser (see osv-parser.ts for the IEEE 754 hazard rationale). Either
 * `debitOut` (we paid) OR `creditIn` (we received) is non-zero, never both;
 * a row with both zero gets returned but flagged in `warnings`.
 *
 * Direction encoding: per bank ТЗ §1, some bank formats encode direction by
 * which of the org's accounts appears in the Счёт column rather than via the
 * Дебет/Кредит split. This parser preserves the Счёт field verbatim so the
 * direction resolver service can disambiguate; the parser itself only
 * surfaces whichever of debitOut/creditIn carries the amount.
 */
export interface ParsedBankRow {
  /** Document date - YYYY-MM-DD string preserved verbatim from XLSX. */
  date: Date;
  /** Counterparty account ("Счёт") - 20-digit string in Uzbek banks. */
  counterpartyAccount: string | null;
  /** Counterparty display name ("Наименование"). */
  counterpartyName: string;
  documentNumber: string | null;
  documentType: string | null;
  bankCode: string | null;
  /** Оборот Дебет - money paid OUT. "0" when blank. */
  debitOut: string;
  /** Оборот кредит - money received. "0" when blank. */
  creditIn: string;
  /** Free-text Назначение платежа - treasury rule lookup operates on this. */
  purpose: string;
  /** Кассовый символ - Описание sheet flags it as unimportant; preserved for audit. */
  cashSymbol: string | null;
  /** Counterparty ИНН - the registry join key. May be null on malformed rows. */
  inn: string | null;
  /** 1-indexed source row. */
  sourceRow: number;
}

export interface BankParseResult {
  rows: ParsedBankRow[];
  warnings: string[];
}

export class BankParseError extends Error {
  constructor(
    message: string,
    public readonly sourceRow?: number,
  ) {
    super(message);
    this.name = 'BankParseError';
  }
}

// Canonical column layout from the analyst's "Bank statement KDB" sample
// (bank ТЗ "Описание" sheet defines exactly these 11 columns).
const HEADER: Record<number, string> = {
  0: 'Дата документа',
  1: 'Счёт',
  2: 'Наименование',
  3: 'Номер документа',
  4: 'Тип документа',
  5: 'Филиал',
  6: 'Оборот Дебет',
  7: 'Оборот кредит',
  8: 'Назначение платежа',
  9: 'Кассовый символ',
  10: 'ИНН',
};

// Same money helper as OSV parser - see there for the IEEE 754 / toFixed(6)
// rationale. Duplicated rather than shared because the public shape (cell vs.
// raw value) might diverge as the bank parser evolves.
const moneyStr = (cell: XLSX.CellObject | undefined): string => {
  if (!cell || cell.v === undefined || cell.v === null) return '0';
  if (typeof cell.v === 'number') {
    if (!Number.isFinite(cell.v)) return '0';
    return cell.v.toFixed(6).replace(/\.?0+$/, '');
  }
  if (typeof cell.v === 'string') return cell.v.trim() || '0';
  return '0';
};

const text = (cell: XLSX.CellObject | undefined): string => {
  if (!cell) return '';
  if (typeof cell.w === 'string') return cell.w.trim();
  if (typeof cell.v === 'string') return cell.v.trim();
  if (typeof cell.v === 'number') return String(cell.v);
  if (cell.v instanceof Date) return cell.v.toISOString().slice(0, 10);
  return '';
};

const parseDate = (cell: XLSX.CellObject | undefined): Date | null => {
  if (!cell || cell.v === undefined || cell.v === null) return null;
  if (cell.v instanceof Date) return cell.v;
  if (typeof cell.v === 'number') {
    // Excel serial date - convert via XLSX utility for accuracy.
    const parsed = XLSX.SSF.parse_date_code(cell.v);
    if (!parsed) return null;
    return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
  }
  if (typeof cell.v === 'string') {
    // Russian-style DD.MM.YYYY common in Uzbek bank exports.
    const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(cell.v.trim());
    if (m) {
      const [, d, mo, y] = m;
      return new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
    }
    const d = new Date(cell.v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
};

/**
 * Parse a bank statement Excel export (xlsx or xls). Pure function - no I/O
 * beyond reading the workbook, no database access, no logging.
 *
 * The caller (BankIngestionService) is responsible for resolving counterparties,
 * applying treasury rules, looking up running balances, and deciding the
 * Dt/Cr posting per row. This parser just turns the bytes into structured
 * row records.
 *
 * Workbooks with multiple sheets: the first sheet is parsed. The analyst's
 * Bank statements.xlsx puts the data on the FIRST sheet ("Bank statement
 * KDB" or similar bank-specific name) - we don't hard-pin the name because
 * each bank's export uses its own.
 */
export function parseBankStatement(input: string | Buffer): BankParseResult {
  const wb = XLSX.read(input, {
    type: Buffer.isBuffer(input) ? 'buffer' : 'file',
    cellDates: true,
  });

  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new BankParseError('Workbook contains no sheets');

  const ws = wb.Sheets[sheetName];
  if (!ws || !ws['!ref']) {
    throw new BankParseError('Sheet is empty or has no range');
  }

  const range = XLSX.utils.decode_range(ws['!ref']);
  const lastRow = range.e.r;
  const cell = (r: number, c: number): XLSX.CellObject | undefined =>
    ws[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject | undefined;

  // Header validation - confirm we're looking at a recognized layout. The
  // bank ТЗ Описание sheet pins the column names; if a future bank surfaces
  // a different layout, this throws here rather than producing garbage.
  for (const [colStr, expected] of Object.entries(HEADER)) {
    const col = Number(colStr);
    const got = text(cell(0, col));
    if (got !== expected) {
      throw new BankParseError(
        `Header column ${col} expected "${expected}", got "${got}". Unrecognized statement layout.`,
      );
    }
  }

  const out: ParsedBankRow[] = [];
  const warnings: string[] = [];
  let consecutiveBlanks = 0;

  for (let r = 1; r <= lastRow; r++) {
    const dateCell = cell(r, 0);
    if (!dateCell || dateCell.v === undefined || dateCell.v === null) {
      consecutiveBlanks++;
      if (consecutiveBlanks >= 2) break;
      continue;
    }
    consecutiveBlanks = 0;

    const date = parseDate(dateCell);
    if (!date) {
      warnings.push(`Row ${r + 1}: unparseable date ${JSON.stringify(text(dateCell))}, skipped`);
      continue;
    }

    const counterpartyName = text(cell(r, 2));
    if (!counterpartyName) {
      warnings.push(`Row ${r + 1}: missing counterparty name, skipped`);
      continue;
    }

    const debitOut = moneyStr(cell(r, 6));
    const creditIn = moneyStr(cell(r, 7));

    if (debitOut === '0' && creditIn === '0') {
      warnings.push(`Row ${r + 1}: both Оборот Дебет and Оборот кредит are zero, skipped`);
      continue;
    }
    if (debitOut !== '0' && creditIn !== '0') {
      warnings.push(
        `Row ${r + 1}: both Оборот Дебет (${debitOut}) and Оборот кредит (${creditIn}) carry value - ` +
          `ambiguous direction, included as-is for operator review`,
      );
    }

    out.push({
      date,
      counterpartyAccount: text(cell(r, 1)) || null,
      counterpartyName,
      documentNumber: text(cell(r, 3)) || null,
      documentType: text(cell(r, 4)) || null,
      bankCode: text(cell(r, 5)) || null,
      debitOut,
      creditIn,
      purpose: text(cell(r, 8)),
      cashSymbol: text(cell(r, 9)) || null,
      inn: text(cell(r, 10)) || null,
      sourceRow: r + 1,
    });
  }

  if (out.length === 0) {
    throw new BankParseError('No transaction rows found');
  }

  return { rows: out, warnings };
}
