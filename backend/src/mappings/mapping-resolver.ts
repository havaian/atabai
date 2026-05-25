/**
 * Mapping resolver — used by processors via `getXxxMapping(userId)` calls.
 *
 * DB-first with file fallback, ported from backend/src/services/mappingResolver.js.
 *
 * Resolution order per call:
 *   1. If `userId` is provided, look up a published USER-SPECIFIC MappingSet
 *      whose assignedUsers contains this user.
 *   2. Otherwise (or on miss), look up the published GLOBAL MappingSet
 *      (empty assignedUsers).
 *   3. Fallback to the file constants in this folder.
 *
 * Cache: per-(reportType, userId?) for 60s. Cache key includes the resolved
 * MappingSet `_id`; republishing a set produces a new id which forces a miss
 * on the next read. `invalidateCache(reportType)` is called by
 * AdminMappingsService on publish / delete to bust both the global entry and
 * any user-specific entries for that reportType.
 *
 * Why standalone functions instead of an @Injectable: the per-template
 * processors (balance-sheet.processor.ts etc.) are pure-pipeline modules with
 * @ts-nocheck and no DI. Routing them through DI would require touching every
 * processor; we instead reach into the registered Mongoose models via
 * `mongoose.model(...)`, which is safe once the MongooseModule has booted.
 */

import { Logger } from '@nestjs/common';
import mongoose from 'mongoose';

import * as fileBalanceSheet from './balance-sheet.mapping';
import * as fileCashFlow from './cash-flow.mapping';
import * as fileEquity from './equity.mapping';
import * as fileProfitLossF2 from './profit-loss-form2.mapping';

const logger = new Logger('MappingResolver');

const CACHE_TTL_MS = 60 * 1000;
const FALLBACK_LOG_INTERVAL_MS = 60 * 1000;

interface CacheEntry {
  setId: string;
  data: unknown;
  expiresAt: number;
}

const globalCache = new Map<string, CacheEntry>();
const lastFallbackLog = new Map<string, number>();

function logFallback(reportType: string, reason: string): void {
  const now = Date.now();
  const last = lastFallbackLog.get(reportType) ?? 0;
  if (now - last < FALLBACK_LOG_INTERVAL_MS) return;
  lastFallbackLog.set(reportType, now);
  logger.log(`Falling back to file constants for '${reportType}' (${reason})`);
}

function rowDocToFileShape(doc: Record<string, any>): Record<string, unknown> {
  const out: Record<string, unknown> = {
    nsbuCodes: doc.nsbuCodes || [],
    ifrsClassification: doc.ifrsClassification,
    section: doc.section || '',
  };
  if (doc.nsbuDescription) out.nsbuDescription = doc.nsbuDescription;
  if (doc.subsection) out.subsection = doc.subsection;
  if (doc.isNegative) out.isNegative = true;
  if (doc.isCalculated) out.isCalculated = true;
  if (doc.formula !== null && doc.formula !== undefined) out.formula = doc.formula;
  if (doc.flowType) out.flowType = doc.flowType;
  if (typeof doc.directMethod === 'boolean') out.directMethod = doc.directMethod;
  if (typeof doc.netCalculation === 'boolean') out.netCalculation = doc.netCalculation;
  if (doc.label) out.label = doc.label;
  if (doc.accountDetails) out.accountDetails = doc.accountDetails;
  return out;
}

async function loadRowBasedFromDb(
  reportType: string,
  userId?: string,
): Promise<Record<string, any> | null> {
  const cacheKey = userId ? `${reportType}:${userId}` : reportType;
  const cached = globalCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data as Record<string, any>;
  }

  try {
    const MappingSet = mongoose.model('MappingSet');
    const RowMapping = mongoose.model('RowMapping');

    let set: any = null;
    if (userId) {
      set = await MappingSet.findOne({
        reportType,
        status: 'published',
        assignedUsers: userId,
      }).lean();
    }
    if (!set) {
      set = await MappingSet.findOne({
        reportType,
        status: 'published',
        assignedUsers: { $size: 0 },
      }).lean();
    }
    if (!set) return null;

    const rows = await RowMapping.find({ mappingSetId: set._id }).lean();
    const out: Record<string, any> = {};
    for (const row of rows as Array<Record<string, any>>) {
      out[row.nsbuRowCode] = rowDocToFileShape(row);
    }

    globalCache.set(cacheKey, {
      setId: String(set._id),
      data: out,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    return out;
  } catch (err) {
    logger.error(`loadRowBasedFromDb failed for ${reportType}: ${(err as Error).message}`);
    return null;
  }
}

// ─── Public API: row-based reports ────────────────────────────────────────────

export async function getBalanceSheetMapping(userId?: string): Promise<Record<string, any>> {
  const fromDb = await loadRowBasedFromDb('balance_sheet', userId);
  if (fromDb) return fromDb;
  logFallback('balance_sheet', 'no published set in DB');
  return fileBalanceSheet.BALANCE_SHEET_MAPPING;
}

export async function getCashFlowMapping(userId?: string): Promise<Record<string, any>> {
  const fromDb = await loadRowBasedFromDb('cash_flow', userId);
  if (fromDb) return fromDb;
  logFallback('cash_flow', 'no published set in DB');
  return fileCashFlow.CASH_FLOW_MAPPING;
}

export async function getProfitLossForm2Mapping(userId?: string): Promise<Record<string, any>> {
  const fromDb = await loadRowBasedFromDb('profit_loss_form2', userId);
  if (fromDb) return fromDb;
  logFallback('profit_loss_form2', 'no published set in DB');
  return fileProfitLossF2.FORM2_ROW_CODES;
}

// ─── Public API: equity ───────────────────────────────────────────────────────

export interface EquityMappingBundle {
  EQUITY_COLUMNS: typeof fileEquity.EQUITY_COLUMNS;
  BS_ROW_TO_EQUITY_COLUMN: typeof fileEquity.BS_ROW_TO_EQUITY_COLUMN;
  EQUITY_MOVEMENT_ROWS: typeof fileEquity.EQUITY_MOVEMENT_ROWS;
  FORM4_ROW_PATTERNS: typeof fileEquity.FORM4_ROW_PATTERNS;
  FORM4_COLUMN_PATTERNS: typeof fileEquity.FORM4_COLUMN_PATTERNS;
}

export async function getEquityMapping(userId?: string): Promise<EquityMappingBundle> {
  const cacheKey = userId ? `equity:${userId}` : 'equity';
  const cached = globalCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data as EquityMappingBundle;
  }

  try {
    const MappingSet = mongoose.model('MappingSet');
    const EquityMappingConfig = mongoose.model('EquityMappingConfig');

    let set: any = null;
    if (userId) {
      set = await MappingSet.findOne({
        reportType: 'equity',
        status: 'published',
        assignedUsers: userId,
      }).lean();
    }
    if (!set) {
      set = await MappingSet.findOne({
        reportType: 'equity',
        status: 'published',
        assignedUsers: { $size: 0 },
      }).lean();
    }

    if (set) {
      const config: any = await EquityMappingConfig.findOne({ mappingSetId: set._id }).lean();
      if (config) {
        const compilePattern = (p: { key: string; pattern: string; flags?: string }) => ({
          key: p.key,
          pattern: new RegExp(p.pattern, p.flags || 'i'),
        });

        const data: EquityMappingBundle = {
          EQUITY_COLUMNS: (config.columns || []).map((c: any) => ({
            key: c.key,
            label: c.label,
            nsbuRows: c.nsbuRows || [],
            isNegative: !!c.isNegative,
            isCalculated: !!c.isCalculated,
          })),
          BS_ROW_TO_EQUITY_COLUMN: config.bsRowToEquityColumn
            ? config.bsRowToEquityColumn instanceof Map
              ? (Object.fromEntries(config.bsRowToEquityColumn) as Record<string, string>)
              : ({ ...config.bsRowToEquityColumn } as Record<string, string>)
            : {},
          EQUITY_MOVEMENT_ROWS: (config.movementRows || []).map((r: any) => ({
            key: r.key,
            label: r.label,
            isTotal: !!r.isTotal,
          })),
          FORM4_ROW_PATTERNS: (config.rowPatterns || []).map(compilePattern),
          FORM4_COLUMN_PATTERNS: (config.columnPatterns || []).map(compilePattern),
        };

        globalCache.set(cacheKey, {
          setId: String(set._id),
          data,
          expiresAt: Date.now() + CACHE_TTL_MS,
        });
        return data;
      }
    }
    logFallback('equity', 'no published set/config in DB');
  } catch (err) {
    logger.error(`getEquityMapping failed: ${(err as Error).message}`);
    logFallback('equity', 'DB error: ' + (err as Error).message);
  }

  return {
    EQUITY_COLUMNS: fileEquity.EQUITY_COLUMNS,
    BS_ROW_TO_EQUITY_COLUMN: fileEquity.BS_ROW_TO_EQUITY_COLUMN,
    EQUITY_MOVEMENT_ROWS: fileEquity.EQUITY_MOVEMENT_ROWS,
    FORM4_ROW_PATTERNS: fileEquity.FORM4_ROW_PATTERNS,
    FORM4_COLUMN_PATTERNS: fileEquity.FORM4_COLUMN_PATTERNS,
  };
}

/**
 * Wipes the global cache entry AND every user-specific entry for the
 * given reportType. Called by AdminMappingsService after publish/delete.
 * Passing no argument clears the entire cache.
 */
export function invalidateCache(reportType?: string): void {
  if (!reportType) {
    globalCache.clear();
    return;
  }
  const prefix = `${reportType}:`;
  globalCache.delete(reportType);
  for (const key of globalCache.keys()) {
    if (key.startsWith(prefix)) globalCache.delete(key);
  }
}
