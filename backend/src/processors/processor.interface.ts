import type * as ExcelJS from 'exceljs';

import type { TemplateType } from '../common/constants/template-types';

/**
 * Shape returned by every template processor. Mirrors the legacy
 * `{ workbook, summary, transformation }` triple that processors/balanceSheet.js
 * etc. produce.
 */
export interface ProcessorResult {
  workbook: ExcelJS.Workbook;
  summary: ProcessorSummary;
  /**
   * Optional sibling JSON written to disk for the before/after diff view.
   * Some templates don't emit this yet — when absent, the transformation
   * endpoint surfaces TRANSFORMATION_NOT_AVAILABLE.
   */
  transformation?: unknown;
}

export interface ProcessorSummary {
  transformations?: number;
  changes?: number;
  originalRows?: number;
  processedRows?: number;
  warnings?: Array<{
    message?: string;
    row?: number;
    column?: string;
    severity?: 'info' | 'warning' | 'error';
  }>;
  summary?: string;
  worksheets?: Array<{
    name?: string;
    originalRows?: number;
    processedRows?: number;
    changes?: number;
  }>;
}

export interface ProcessorOptions {
  /** Owning user — used by the mapping resolver to pick up user-specific MappingSets. */
  userId: string;
}

/**
 * Contract every Phase-6 processor implementation satisfies. The files module
 * depends on this abstract symbol so we can swap the stub for the real
 * processor pipeline without touching files.service.
 */
export interface IProcessorService {
  process(
    templateType: TemplateType,
    filePath: string,
    options: ProcessorOptions,
  ): Promise<ProcessorResult>;
}

/** DI token — bound to the concrete provider in ProcessorsModule. */
export const PROCESSOR_SERVICE = Symbol('PROCESSOR_SERVICE');
