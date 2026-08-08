import * as XLSX from 'xlsx';

import {
  INVOICE_SUBTYPE,
  type InvoiceDirection,
  type InvoiceSubtype,
} from '../constants/invoice';

/**
 * Didox e-invoice registry (реестр ЭЛЕКТРОННЫХ ДОКУМЕНТОВ) parser.
 *
 * Validated against the real exports `extended_registry_27-06-2026 -
 * Входящие/Исходящие.xlsx` (single sheet «Worksheet», 37 columns). Structure
 * confirmed with Filipp:
 *
 *   - Row 1 is a title («РЕЕСТР ЭЛЕКТРОННЫХ ДОКУМЕНТОВ»); row 2 is the header;
 *     row 3 carries a second-level sub-header for the «Маркировки» group only
 *     (skipped as a blank data row). The header row is located by name, not
 *     pinned to row 2.
 *   - ONE ROW = ONE LINE ITEM. An invoice with several positions spans several
 *     rows; the invoice-header columns (number, ids, ИНН, subtype, contract…)
 *     are filled ONLY on the invoice's FIRST row and are BLANK on its
 *     continuation rows, which carry just the line-item columns. Rows are
 *     therefore grouped into invoices: a row with a document number/ID starts a
 *     new invoice; a header-less row with line data continues the current one.
 *   - Only «Подписан» invoices are loaded. The real files also carry «Удален»,
 *     «Недействительный», «Ожидает …подписи», «Отказ от подписи» - all excluded.
 *   - Subtype is «Подтип документа» (Стандартный / Исправленный / Дополнительный)
 *     - distinct from «Тип документа» (the doc KIND, e.g. «Счет-фактура без
 *     акта»), which is intentionally not mapped.
 *
 * Column resolution is by header NAME (position-independent): all header
 * strings live in COLUMN_ALIASES, matched exact-first then by substring. If a
 * required column (invoice number, counterparty ИНН) can't be found, the parser
 * throws a diagnostic listing the headers it saw. Money values are decimal
 * strings - the same precision discipline as the bank/OSV parsers.
 *
 * NOTE (phase 5): «Код ИКПУ» is exported inconsistently by Didox - a text cell
 * with a leading zero in one file, a 17-digit number in the other. It is
 * captured here for the line label; exact ИКПУ-directory matching (phase 5)
 * should treat it as text, as a 17-digit numeric code can lose its last digit
 * to float storage in the source file.
 */

/** One parsed line of a registry invoice. Money values are decimal strings. */
export interface ParsedRegistryLineItem {
  ikpuCode: string | null;
  ikpuName: string | null;
  quantity: string | null;
  price: string | null;
  netAmount: string;
  /** VAT percent (e.g. 12, 0), or null when the cell is textual/absent. */
  vatRate: number | null;
  vatAmount: string;
  grossAmount: string;
}

/** One «Подписан» registry invoice, grouped from its line row(s). */
export interface ParsedRegistryInvoice {
  counterpartyInn: string | null;
  counterpartyName: string;
  number: string;
  date: Date | null;
  /** Stamped from the operator-picked upload direction, not read from a column. */
  direction: InvoiceDirection;
  subtype: InvoiceSubtype;
  documentStatus: string | null;
  didoxId: string | null;
  roumingId: string | null;
  /** Didox id of the invoice this one corrects/supplements (§7.5), else null. */
  oldInvoiceDidoxId: string | null;
  contractNumber: string | null;
  contractDate: Date | null;
  lineItems: ParsedRegistryLineItem[];
  /** 1-indexed source row of this invoice's first (header) row. */
  sourceRow: number;
}

export interface InvoiceRegistryParseResult {
  invoices: ParsedRegistryInvoice[];
  /** Invoices whose status was not «Подписан» - counted, not loaded. */
  skippedUnsigned: number;
  warnings: string[];
}

export class InvoiceRegistryParseError extends Error {
  constructor(
    message: string,
    public readonly sourceRow?: number,
  ) {
    super(message);
    this.name = 'InvoiceRegistryParseError';
  }
}

// ─── Column aliases - THE single place Didox header names live ────────────────
// Normalized (lowercase, ё→е, punctuation→space, collapsed whitespace) header
// fragments; the matcher normalizes both sides. Exact matches win over
// substring matches (so «Цена» beats «Базовая цена», «Сумма с НДС» beats a
// broader match). To retarget a future export, edit here - nothing else changes.
const COLUMN_ALIASES: Record<string, string[]> = {
  status: ['статус документа', 'статус'],
  roumingId: ['id у роуминга', 'роуминг'],
  didoxId: ['id didox', 'didox'],
  oldInvoiceDidoxId: ['id старой счет фактуры', 'старой счет фактуры', 'старой'],
  // «Подтип документа» = Стандартный/Исправленный/Дополнительный. NOT «Тип
  // документа» (the doc kind) - that would collide, so it is left unmapped.
  subtype: ['подтип документа', 'подтип'],
  number: ['номер документа', 'номер счет', 'номер эсф', 'номер сф', 'номер фактур'],
  date: ['дата документа', 'дата счет', 'дата эсф', 'дата фактур'],
  // Contract columns are resolved before number/date (RESOLUTION_ORDER) so the
  // «…договора» headers are claimed first and not mistaken for the invoice's.
  contractNumber: ['номер договора', 'договор'],
  contractDate: ['дата договора'],
  inn: ['инн контрагента', 'инн'],
  name: ['наименование контрагента', 'контрагент'],
  ikpuCode: ['код икпу'],
  ikpuName: ['наименование икпу'],
  quantity: ['кол во', 'количество'],
  price: ['цена'], // exact match beats «Базовая цена»
  netAmount: ['сумма без ндс', 'стоимость без ндс'],
  vatRate: ['ставка ндс', 'ставка'],
  vatAmount: ['сумма ндс', 'сумма налога'],
  grossAmount: ['сумма с ндс', 'стоимость с ндс'],
};

type FieldKey = keyof typeof COLUMN_ALIASES;

// Resolution order - distinctive «…договора» columns before the invoice
// number/date; ИНН/name before the line-item «наименование» columns.
const RESOLUTION_ORDER: FieldKey[] = [
  'status', 'roumingId', 'didoxId', 'oldInvoiceDidoxId', 'subtype',
  'contractNumber', 'contractDate', 'number', 'date', 'inn', 'name',
  'ikpuCode', 'ikpuName', 'quantity', 'price',
  'netAmount', 'vatRate', 'vatAmount', 'grossAmount',
];

// Without these a row can't be booked to a counterparty position/document.
const REQUIRED_FIELDS: FieldKey[] = ['number', 'inn'];

// Line-item columns - used to tell a continuation row (blank header, line data)
// from a truly blank row.
const LINE_FIELDS: FieldKey[] = [
  'ikpuCode', 'ikpuName', 'quantity', 'price', 'netAmount', 'vatAmount', 'grossAmount',
];

// ─── Cell + value helpers (mirror the bank parser) ────────────────────────────

const normalizeHeader = (s: string): string =>
  s
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^0-9a-zа-я]+/gi, ' ')
    .trim()
    .replace(/\s+/g, ' ');

const text = (cell: XLSX.CellObject | undefined): string => {
  if (!cell) return '';
  if (typeof cell.w === 'string') return cell.w.trim();
  if (typeof cell.v === 'string') return cell.v.trim();
  if (typeof cell.v === 'number') return String(cell.v);
  if (cell.v instanceof Date) return cell.v.toISOString().slice(0, 10);
  return '';
};

const textOrNull = (cell: XLSX.CellObject | undefined): string | null => {
  const t = text(cell);
  return t === '' ? null : t;
};

// Decimal string, "0" when blank - same IEEE-754 discipline as bank/OSV parsers.
const moneyStr = (cell: XLSX.CellObject | undefined): string => {
  if (!cell || cell.v === undefined || cell.v === null) return '0';
  if (typeof cell.v === 'number') {
    if (!Number.isFinite(cell.v)) return '0';
    return cell.v.toFixed(6).replace(/\.?0+$/, '');
  }
  if (typeof cell.v === 'string') {
    const cleaned = cell.v.replace(/[\s\u00a0]/g, '').replace(',', '.').trim();
    return cleaned === '' ? '0' : cleaned;
  }
  return '0';
};

// Like moneyStr but null (not "0") when the column/value is absent.
const decimalOrNull = (cell: XLSX.CellObject | undefined): string | null => {
  if (!cell || cell.v === undefined || cell.v === null) return null;
  if (typeof cell.v === 'string' && cell.v.trim() === '') return null;
  return moneyStr(cell);
};

// VAT rate as a percent number (12, 0, …) or null. Handles "12%", "12", text.
const parseRate = (cell: XLSX.CellObject | undefined): number | null => {
  if (!cell || cell.v === undefined || cell.v === null) return null;
  if (typeof cell.v === 'number') return Number.isFinite(cell.v) ? cell.v : null;
  const raw = String(cell.v).trim();
  if (raw === '') return null;
  const m = /-?\d+(?:[.,]\d+)?/.exec(raw.replace(/\s/g, ''));
  if (!m) return null; // e.g. «Без НДС» textual - no numeric rate.
  const n = Number(m[0].replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

const parseDate = (cell: XLSX.CellObject | undefined): Date | null => {
  if (!cell || cell.v === undefined || cell.v === null) return null;
  if (cell.v instanceof Date) return cell.v;
  if (typeof cell.v === 'number') {
    const parsed = XLSX.SSF.parse_date_code(cell.v);
    if (!parsed) return null;
    return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
  }
  if (typeof cell.v === 'string') {
    const s = cell.v.trim();
    // ISO YYYY-MM-DD (the real export's format).
    const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
    if (iso) {
      const [, y, mo, d] = iso;
      return new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
    }
    // Russian-style DD.MM.YYYY (as on the printed СФ).
    const ru = /^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/.exec(s);
    if (ru) {
      const [, d, mo, y] = ru;
      return new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
    }
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
};

// ИКПУ code reader. Didox exports it inconsistently: a TEXT cell (leading zero
// preserved) in one file, a NUMBER in another - where SheetJS's formatted text
// is scientific ("1.0103E+16"). For a numeric cell, render the full integer;
// for a text cell, keep it verbatim. NOTE (phase 5): a 17-digit numeric code can
// already have lost its last digit to float storage in the source; exact
// directory matching should rely on the text form.
const readIkpuCode = (cell: XLSX.CellObject | undefined): string | null => {
  if (!cell || cell.v === undefined || cell.v === null) return null;
  if (typeof cell.v === 'number' && Number.isFinite(cell.v)) {
    return BigInt(Math.round(cell.v)).toString();
  }
  return textOrNull(cell);
};

const mapSubtype = (raw: string | null): InvoiceSubtype => {
  const n = normalizeHeader(raw ?? '');
  if (n.includes('исправл')) return INVOICE_SUBTYPE.CORRECTED;
  if (n.includes('дополн')) return INVOICE_SUBTYPE.ADDITIONAL;
  return INVOICE_SUBTYPE.STANDARD;
};

const isSigned = (status: string | null): boolean =>
  normalizeHeader(status ?? '').includes('подписан');

// ─── Header resolution (exact-first, then substring) ──────────────────────────

type ColumnMap = Partial<Record<FieldKey, number>>;

const NORMALIZED_ALIASES: Record<FieldKey, string[]> = Object.keys(
  COLUMN_ALIASES,
).reduce((acc, field) => {
  acc[field] = COLUMN_ALIASES[field].map(normalizeHeader);
  return acc;
}, {} as Record<FieldKey, string[]>);

const resolveColumns = (headerCells: string[]): ColumnMap => {
  const norm = headerCells.map(normalizeHeader);
  const claimed = new Set<number>();
  const map: ColumnMap = {};

  const claim = (test: (colHeader: string, alias: string) => boolean): void => {
    for (const field of RESOLUTION_ORDER) {
      if (map[field] !== undefined) continue;
      for (let c = 0; c < norm.length; c++) {
        if (claimed.has(c) || norm[c] === '') continue;
        if (NORMALIZED_ALIASES[field].some((a) => test(norm[c], a))) {
          map[field] = c;
          claimed.add(c);
          break;
        }
      }
    }
  };

  claim((h, a) => h === a); // exact wins globally
  claim((h, a) => h.includes(a)); // then substring
  return map;
};

// ─── Main ─────────────────────────────────────────────────────────────────────

/**
 * Parse a Didox invoice-registry Excel export (Входящие or Исходящие). Pure
 * function - reads the workbook only. `direction` is the operator-picked upload
 * direction (stamped on every invoice; the counterparty column is a single
 * «ИНН/Наименование контрагента», so direction is not needed to pick it).
 *
 * Returns every «Подписан» invoice grouped from its line row(s), the count of
 * skipped unsigned invoices, and per-row warnings. Returns an empty invoice
 * list (not an error) when nothing loads. THROWS only when the sheet is
 * unusable or a required column can't be located (with a diagnostic).
 */
export function parseInvoiceRegistry(
  input: string | Buffer,
  direction: InvoiceDirection,
): InvoiceRegistryParseResult {
  const wb = XLSX.read(input, {
    type: Buffer.isBuffer(input) ? 'buffer' : 'file',
    cellDates: true,
  });

  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new InvoiceRegistryParseError('Workbook contains no sheets');
  const ws = wb.Sheets[sheetName];
  if (!ws || !ws['!ref']) {
    throw new InvoiceRegistryParseError('Sheet is empty or has no range');
  }

  const range = XLSX.utils.decode_range(ws['!ref']);
  const lastRow = range.e.r;
  const lastCol = range.e.c;
  const cell = (r: number, c: number): XLSX.CellObject | undefined =>
    ws[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject | undefined;
  const rowCells = (r: number): string[] => {
    const cells: string[] = [];
    for (let c = 0; c <= lastCol; c++) cells.push(text(cell(r, c)));
    return cells;
  };

  // Locate the header row within the first 15 rows (a title/preamble above it is
  // tolerated). Take the first row resolving BOTH required fields; keep the best
  // partial for the diagnostic if none qualifies.
  const searchLimit = Math.min(lastRow, 14);
  let headerRow = -1;
  let columns: ColumnMap = {};
  let bestRow = -1;
  let bestCols: ColumnMap = {};
  let bestScore = -1;
  for (let r = 0; r <= searchLimit; r++) {
    const cols = resolveColumns(rowCells(r));
    const score = Object.keys(cols).length;
    if (score > bestScore) {
      bestScore = score;
      bestRow = r;
      bestCols = cols;
    }
    if (REQUIRED_FIELDS.every((f) => cols[f] !== undefined)) {
      headerRow = r;
      columns = cols;
      break;
    }
  }

  if (headerRow === -1) {
    const found = bestRow >= 0 ? rowCells(bestRow).filter((h) => h !== '') : [];
    const missing = REQUIRED_FIELDS.filter((f) => bestCols[f] === undefined);
    throw new InvoiceRegistryParseError(
      `Could not locate required column(s) [${missing.join(', ')}] in the registry ` +
        `header. Best header row found (row ${bestRow + 1}) had: ` +
        `${found.length ? found.map((h) => `"${h}"`).join(', ') : '(no non-empty headers)'}. ` +
        `Update COLUMN_ALIASES in invoice-registry-parser.ts to match this export's headers.`,
    );
  }

  const warnings: string[] = [];
  if (columns.status === undefined) {
    warnings.push(
      'No status column found - every row was loaded WITHOUT the «Подписан» filter.',
    );
  }
  if (columns.netAmount === undefined && columns.grossAmount === undefined) {
    warnings.push('No net/gross amount column matched - invoice amounts may parse as 0.');
  }

  const at = (r: number, f: FieldKey): XLSX.CellObject | undefined =>
    columns[f] === undefined ? undefined : cell(r, columns[f]!);

  const buildLine = (r: number): ParsedRegistryLineItem => ({
    ikpuCode: readIkpuCode(at(r, 'ikpuCode')),
    ikpuName: textOrNull(at(r, 'ikpuName')),
    quantity: decimalOrNull(at(r, 'quantity')),
    price: decimalOrNull(at(r, 'price')),
    netAmount: moneyStr(at(r, 'netAmount')),
    vatRate: parseRate(at(r, 'vatRate')),
    vatAmount: moneyStr(at(r, 'vatAmount')),
    grossAmount: moneyStr(at(r, 'grossAmount')),
  });

  interface Group {
    header: Omit<ParsedRegistryInvoice, 'direction' | 'lineItems'>;
    lineItems: ParsedRegistryLineItem[];
  }
  const groups: Group[] = [];
  let current: Group | null = null;
  let consecutiveBlanks = 0;

  for (let r = headerRow + 1; r <= lastRow; r++) {
    const number = text(at(r, 'number'));
    const didoxId = text(at(r, 'didoxId'));
    // A row starting a new invoice carries the document number / Didox id; the
    // invoice header lives on this row only. Continuation rows have both blank.
    const startsInvoice = number !== '' || didoxId !== '';
    const hasLineData = LINE_FIELDS.some((f) => text(at(r, f)) !== '');

    if (startsInvoice) {
      consecutiveBlanks = 0;
      if (!number) {
        // Has an id but no number - can't dedup/post it; skip the whole invoice.
        warnings.push(`Row ${r + 1}: invoice row has no number, skipped`);
        current = null;
        continue;
      }
      current = {
        header: {
          counterpartyInn: textOrNull(at(r, 'inn')),
          counterpartyName: text(at(r, 'name')),
          number,
          date: parseDate(at(r, 'date')),
          subtype: mapSubtype(textOrNull(at(r, 'subtype'))),
          documentStatus: textOrNull(at(r, 'status')),
          didoxId: textOrNull(at(r, 'didoxId')),
          roumingId: textOrNull(at(r, 'roumingId')),
          oldInvoiceDidoxId: textOrNull(at(r, 'oldInvoiceDidoxId')),
          contractNumber: textOrNull(at(r, 'contractNumber')),
          contractDate: parseDate(at(r, 'contractDate')),
          sourceRow: r + 1,
        },
        lineItems: [buildLine(r)],
      };
      groups.push(current);
    } else if (hasLineData) {
      consecutiveBlanks = 0;
      // Continuation line of the current invoice. A stray line before any
      // invoice header (no current group) is dropped with a warning.
      if (current) current.lineItems.push(buildLine(r));
      else warnings.push(`Row ${r + 1}: line data with no preceding invoice header, skipped`);
    } else {
      // Truly blank - end the sheet after two in a row (tolerates a trailing
      // block / the row-3 sub-header).
      consecutiveBlanks++;
      if (consecutiveBlanks >= 2) break;
    }
  }

  // Keep only «Подписан» invoices; count the rest.
  const invoices: ParsedRegistryInvoice[] = [];
  let skippedUnsigned = 0;
  const hasStatusColumn = columns.status !== undefined;

  for (const g of groups) {
    if (hasStatusColumn && !isSigned(g.header.documentStatus)) {
      skippedUnsigned++;
      continue;
    }
    if (g.lineItems.every((l) => l.netAmount === '0' && l.grossAmount === '0')) {
      warnings.push(
        `Invoice ${g.header.number} (row ${g.header.sourceRow}): no net/gross amount on any line`,
      );
    }
    invoices.push({ ...g.header, direction, lineItems: g.lineItems });
  }

  return { invoices, skippedUnsigned, warnings };
}
