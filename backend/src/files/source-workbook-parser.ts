import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';

/**
 * Converts a raw .xlsx file on disk into the JSON shape Univer 0.20 expects,
 * so the frontend can render the uploaded file in the TransformationView
 * "Source" tab. Ported from backend/src/files/sourceWorkbookParser.js — value
 * extraction, header styling, merge handling and column-width approximation
 * preserved exactly.
 */

const MAX_ROWS_PER_SHEET = 5000;
const MAX_COLS_PER_SHEET = 50;

// Used when ExcelJS doesn't surface a usable numFmt for a numeric cell.
const FALLBACK_NUM_FMT = '#,##0.00;(#,##0.00)';

const STYLES = {
  headerBg: '#F3F0FA',
  headerFg: '#1F1A2C',
} as const;

// Excel allows control characters in sheet names; Univer's tab renderer chokes.
// Built via RegExp constructor to keep the source file ASCII-clean.
const CONTROL_CHAR_RE = new RegExp('[\\x00-\\x1f]', 'g');

interface UniverCellStyle {
  bg?: { rgb: string };
  cl?: { rgb: string };
  bl?: number;
  n?: { pattern: string };
}

interface UniverCell {
  v: unknown;
  s?: UniverCellStyle;
}

interface UniverMerge {
  startRow: number;
  endRow: number;
  startColumn: number;
  endColumn: number;
}

export interface UniverWorksheet {
  id: string;
  name: string;
  tabColor: string;
  hidden: number;
  zoomRatio: number;
  freeze: { startRow: number; startColumn: number; xSplit: number; ySplit: number };
  scrollTop: number;
  scrollLeft: number;
  defaultColumnWidth: number;
  defaultRowHeight: number;
  mergeData: UniverMerge[];
  rowData: Record<number, unknown>;
  columnData: Record<number, { w: number }>;
  rowHeader: { width: number };
  columnHeader: { height: number };
  showGridlines: number;
  rightToLeft: number;
  rowCount: number;
  columnCount: number;
  cellData: Record<number, Record<number, UniverCell>>;
}

export interface UniverWorkbook {
  id: string;
  name: string;
  appVersion: string;
  locale: string;
  styles: Record<string, unknown>;
  sheetOrder: string[];
  sheets: Record<string, UniverWorksheet>;
}

@Injectable()
export class SourceWorkbookParser {
  async parse(filePath: string): Promise<UniverWorkbook> {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(filePath);

    const sheets: Record<string, UniverWorksheet> = {};
    const sheetOrder: string[] = [];

    wb.eachSheet((sheet, sheetIndex) => {
      const idx = sheetIndex - 1;
      const converted = this.convertSheet(sheet, idx);
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

  private worksheetBase(
    id: string,
    name: string,
  ): Omit<UniverWorksheet, 'rowCount' | 'columnCount' | 'cellData'> {
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

  private extractValue(cell: ExcelJS.Cell): unknown {
    if (cell == null) return null;
    const v = cell.value;
    if (v == null) return null;
    if (typeof v === 'object' && v !== null && 'result' in v) {
      const r = (v as { result?: unknown }).result;
      return r == null ? null : r;
    }
    if (
      typeof v === 'object' &&
      v !== null &&
      Array.isArray((v as { richText?: unknown[] }).richText)
    ) {
      return (v as { richText: Array<{ text?: string }> }).richText
        .map((r) => r.text || '')
        .join('');
    }
    if (typeof v === 'object' && v !== null && 'text' in v && 'hyperlink' in v) {
      const o = v as { text?: string; hyperlink?: string };
      return o.text || o.hyperlink;
    }
    if (v instanceof Date) return v.toISOString();
    return v;
  }

  private buildCellStyle(cell: ExcelJS.Cell, isHeaderRow: boolean): UniverCellStyle {
    const style: UniverCellStyle = {};

    if (isHeaderRow) {
      style.bg = { rgb: STYLES.headerBg };
      style.cl = { rgb: STYLES.headerFg };
      style.bl = 1;
    } else if (cell.font?.bold) {
      style.bl = 1;
    }

    if (typeof cell.value === 'number') {
      const fmt = typeof cell.numFmt === 'string' ? cell.numFmt : FALLBACK_NUM_FMT;
      style.n = { pattern: fmt };
    }

    return style;
  }

  private convertSheet(sheet: ExcelJS.Worksheet, sheetIndex: number): UniverWorksheet {
    const id = `source-sheet-${sheetIndex}`;
    const name = (sheet.name || `Sheet ${sheetIndex + 1}`).replace(CONTROL_CHAR_RE, '');

    const cellData: Record<number, Record<number, UniverCell>> = {};
    let maxRow = 0;
    let maxCol = 0;

    const rowCount = Math.min(sheet.rowCount, MAX_ROWS_PER_SHEET);

    for (let rowNum = 1; rowNum <= rowCount; rowNum++) {
      const row = sheet.getRow(rowNum);
      if (!row || row.cellCount === 0) continue;
      const isHeaderRow = rowNum === 1;

      for (let colNum = 1; colNum <= sheet.columnCount && colNum <= MAX_COLS_PER_SHEET; colNum++) {
        const cell = row.getCell(colNum);
        const value = this.extractValue(cell);
        if (value === null || value === '') continue;

        const r = rowNum - 1;
        const c = colNum - 1;

        if (!cellData[r]) cellData[r] = {};
        const style = this.buildCellStyle(cell, isHeaderRow);
        cellData[r][c] = Object.keys(style).length > 0 ? { v: value, s: style } : { v: value };

        if (r > maxRow) maxRow = r;
        if (c > maxCol) maxCol = c;
      }
    }

    const columnData: Record<number, { w: number }> = {};
    if (sheet.columns && sheet.columns.length > 0) {
      sheet.columns.forEach((col, idx) => {
        if (idx >= MAX_COLS_PER_SHEET) return;
        const w = col.width;
        if (typeof w === 'number' && w > 0) {
          columnData[idx] = { w: Math.round(w * 7) };
        }
      });
    }

    const mergeData: UniverMerge[] = [];
    const model = sheet.model as { merges?: string[] };
    if (Array.isArray(model.merges)) {
      for (const range of model.merges) {
        const parsed = this.parseA1Range(range);
        if (parsed) mergeData.push(parsed);
      }
    }

    return {
      ...this.worksheetBase(id, name),
      rowCount: Math.max(maxRow + 10, 30),
      columnCount: Math.max(maxCol + 3, 10),
      cellData,
      columnData,
      mergeData,
    };
  }

  private parseA1Range(range: string): UniverMerge | null {
    if (typeof range !== 'string') return null;
    const match = range.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
    if (!match) return null;
    const [, c1, r1, c2, r2] = match;
    return {
      startRow: parseInt(r1, 10) - 1,
      endRow: parseInt(r2, 10) - 1,
      startColumn: this.colLettersToNum(c1),
      endColumn: this.colLettersToNum(c2),
    };
  }

  private colLettersToNum(letters: string): number {
    let n = 0;
    for (let i = 0; i < letters.length; i++) {
      n = n * 26 + (letters.charCodeAt(i) - 64);
    }
    return n - 1;
  }
}
