import * as ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';

/**
 * Universal Excel reader. Accepts a path, Buffer, or an existing ExcelJS
 * Workbook and returns a normalized structure the extractors operate on.
 *
 * Each normalized cell carries:
 *   value     resolved value (formula → result, rich text joined, hyperlink → text)
 *   rawValue  the original ExcelJS / XLSX cell payload
 *   type      cell type code if surfaced by the underlying library
 *   formula   present when the cell holds a formula
 *   row, col  1-indexed coordinates
 *   bold      true if the cell font is bold (used for subheader detection)
 *   indent    cell alignment indent level (0 = no indent)
 *
 * Lives in backend/src/common/excel/ as shared infrastructure: the heuristic
 * sheet scorer (pickBestSheet) and the cell/row helpers are reused by every
 * transaction-source module's parser (bank, then purchases, sales). Lifted
 * here out of processors/readers/ so it survives the removal of the legacy
 * transformation pipeline. Every heuristic (cell-value flattening,
 * multi-format support, bold/indent propagation, sheet picker) preserved
 * exactly from the original.
 */

export interface NormalizedCell {
  value: unknown;
  rawValue: unknown;
  type: number | string | null;
  formula: string | null | undefined;
  column: number;
  row: number;
  bold: boolean;
  indent: number;
}

export interface NormalizedSheet {
  name: string;
  data: NormalizedCell[][];
  range: { startRow: number; endRow: number; startCol: number; endCol: number };
  rowCount: number;
  columnCount: number;
}

export interface NormalizedWorkbook {
  sheets: NormalizedSheet[];
  sheetCount: number;
}

export type ExcelInput = string | Buffer | ExcelJS.Workbook;

export async function readExcelFile(input: ExcelInput): Promise<NormalizedWorkbook> {
  try {
    // Already an ExcelJS Workbook - normalize directly.
    if (
      input &&
      typeof input === 'object' &&
      'worksheets' in input &&
      Array.isArray((input as ExcelJS.Workbook).worksheets)
    ) {
      return await normalizeExcelJSWorkbook(input as ExcelJS.Workbook);
    }

    // .xlsx file path - ExcelJS gives us font.bold / alignment.indent.
    if (typeof input === 'string' && input.toLowerCase().endsWith('.xlsx')) {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.readFile(input);
      return await normalizeExcelJSWorkbook(wb);
    }

    // Fallback: XLSX library handles .xls and Buffer inputs.
    const workbook = XLSX.read(input as string | Buffer, {
      type: Buffer.isBuffer(input) ? 'buffer' : 'file',
      cellStyles: true,
      cellDates: true,
    });

    return normalizeXLSXWorkbook(workbook);
  } catch (error) {
    throw new Error(`Failed to read Excel file: ${(error as Error).message}`);
  }
}

export async function normalizeExcelJSWorkbook(
  workbook: ExcelJS.Workbook,
): Promise<NormalizedWorkbook> {
  const sheets: NormalizedSheet[] = [];

  for (const worksheet of workbook.worksheets) {
    const normalized = normalizeExcelJSWorksheet(worksheet);
    sheets.push({
      name: worksheet.name,
      data: normalized.data,
      range: normalized.range,
      rowCount: normalized.rowCount,
      columnCount: normalized.columnCount,
    });
  }

  return { sheets, sheetCount: sheets.length };
}

function normalizeExcelJSWorksheet(worksheet: ExcelJS.Worksheet): Omit<NormalizedSheet, 'name'> {
  const data: NormalizedCell[][] = [];
  let maxRow = 0;
  let maxCol = 0;

  worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const rowData: NormalizedCell[] = [];

    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      maxCol = Math.max(maxCol, colNumber);

      rowData.push({
        value: getCellValueFromExcelJS(cell),
        rawValue: cell.value,
        type: cell.type as unknown as number,
        formula: cell.formula,
        column: colNumber,
        row: rowNumber,
        bold: cell.font?.bold === true,
        indent: cell.alignment?.indent ?? 0,
      });
    });

    // Fill empty cells up to maxCol so column indexing stays consistent.
    while (rowData.length < maxCol) {
      rowData.push({
        value: null,
        rawValue: null,
        type: null,
        formula: null,
        column: rowData.length + 1,
        row: rowNumber,
        bold: false,
        indent: 0,
      });
    }

    data.push(rowData);
    maxRow = Math.max(maxRow, rowNumber);
  });

  return {
    data,
    range: { startRow: 1, endRow: maxRow, startCol: 1, endCol: maxCol },
    rowCount: maxRow,
    columnCount: maxCol,
  };
}

export function getCellValueFromExcelJS(cell: ExcelJS.Cell): unknown {
  if (!cell || cell.value == null) return null;
  const v = cell.value as unknown;

  if (typeof v === 'object' && v !== null) {
    const o = v as { richText?: unknown; hyperlink?: unknown; text?: string; formula?: unknown; result?: unknown; error?: unknown };
    if (Array.isArray(o.richText)) {
      return (o.richText as Array<{ text?: string }>).map((t) => t.text || '').join(' ');
    }
    if (o.hyperlink) return o.text || o.hyperlink;
    if (o.formula) return o.result;
    if (v instanceof Date) return v;
    if (o.error) return null;
  }
  return v;
}

export function normalizeXLSXWorkbook(workbook: XLSX.WorkBook): NormalizedWorkbook {
  const sheets: NormalizedSheet[] = [];

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const normalized = normalizeXLSXWorksheet(worksheet);
    sheets.push({
      name: sheetName,
      data: normalized.data,
      range: normalized.range,
      rowCount: normalized.rowCount,
      columnCount: normalized.columnCount,
    });
  }

  return { sheets, sheetCount: sheets.length };
}

function normalizeXLSXWorksheet(worksheet: XLSX.WorkSheet): Omit<NormalizedSheet, 'name'> {
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
  const data: NormalizedCell[][] = [];

  for (let R = range.s.r; R <= range.e.r; ++R) {
    const row: NormalizedCell[] = [];
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = worksheet[addr] as XLSX.CellObject | undefined;

      row.push({
        value: cell ? getCellValueFromXLSX(cell) : null,
        rawValue: cell?.v ?? null,
        type: cell?.t ?? null,
        formula: cell?.f,
        column: C + 1,
        row: R + 1,
        bold: (cell as unknown as { s?: { font?: { bold?: boolean } } })?.s?.font?.bold === true,
        indent:
          (cell as unknown as { s?: { alignment?: { indent?: number } } })?.s?.alignment?.indent ??
          0,
      });
    }
    data.push(row);
  }

  return {
    data,
    range: {
      startRow: range.s.r + 1,
      endRow: range.e.r + 1,
      startCol: range.s.c + 1,
      endCol: range.e.c + 1,
    },
    rowCount: range.e.r + 1,
    columnCount: range.e.c + 1,
  };
}

export function getCellValueFromXLSX(cell: XLSX.CellObject): unknown {
  if (!cell) return null;
  // SheetJS's `t` union omits 'str' (string-formula result), but real workbooks emit it.
  // Compare as string for the wider set; matches legacy behavior exactly.
  const t = cell.t as string;
  switch (t) {
    case 's':
    case 'str':
      return cell.v || '';
    case 'n':
    case 'b':
    case 'd':
      return cell.v;
    case 'e':
      return null;
    default:
      return cell.v ?? null;
  }
}

// ─── Cell / row helpers (1-indexed) ────────────────────────────────────────────

export function getCell(sheet: NormalizedSheet, row: number, col: number): NormalizedCell | null {
  if (row < 1 || col < 1) return null;
  const rowData = sheet.data[row - 1];
  if (!rowData) return null;
  return rowData[col - 1] || null;
}

export function getRow(sheet: NormalizedSheet, row: number): NormalizedCell[] {
  if (row < 1) return [];
  return sheet.data[row - 1] || [];
}

export function eachCellInRow(
  sheet: NormalizedSheet,
  row: number,
  callback: (cell: NormalizedCell, colIndex: number) => void,
): void {
  const rowData = getRow(sheet, row);
  rowData.forEach((cell, index) => {
    if (cell && cell.value !== null && cell.value !== '') {
      callback(cell, index + 1);
    }
  });
}

// ─── Sheet picker ──────────────────────────────────────────────────────────────

export function pickBestSheet(
  workbook: NormalizedWorkbook,
  scoreFn: (sheet: NormalizedSheet) => number,
  opts: { minScore?: number; label?: string } = {},
): NormalizedSheet {
  const minScore = opts.minScore ?? 1;
  const label = opts.label ?? 'sheet';

  if (!workbook || !Array.isArray(workbook.sheets) || workbook.sheets.length === 0) {
    throw new Error(`Could not detect ${label} structure: workbook has no sheets`);
  }

  const scored = workbook.sheets
    .map((sheet, idx) => ({ sheet, idx, score: scoreFn(sheet) || 0 }))
    .sort((a, b) => b.score - a.score || a.idx - b.idx);

  const winner = scored[0];
  if (!winner || winner.score < minScore) {
    const names = workbook.sheets.map((s) => s.name || '(unnamed)').join(', ');
    throw new Error(
      `Could not detect ${label} structure in any worksheet (checked: ${names}). Expected headers/markers were not found.`,
    );
  }

  return winner.sheet;
}
