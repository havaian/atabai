import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Types } from 'mongoose';

import { AppLoggerService } from '../../common/logger/app-logger.service';
import { BALANCE_LAYER } from '../constants/balance-layers';
import { AccountBalance, type AccountBalanceModel } from '../schemas/account-balance.schema';
import { ChartOfAccount, type ChartOfAccountModel } from '../schemas/chart-of-account.schema';
import { PeriodsService } from '../services/periods.service';
import { type OsvParseResult, type ParsedOsvRow, parseOsv } from './osv-parser';

export interface OsvIngestionSummary {
  /** Number of AccountBalance rows written. */
  inserted: number;
  /** Number of pre-existing nsbu_base balances purged before insert (full-replace mode). */
  replacedRows: number;
  /**
   * Codes present in the ОСВ file that don't exist in the org's ChartOfAccount.
   * The corresponding rows are imported anyway (the chart can be filled in
   * later) but surfaced here so the operator can decide whether to seed first.
   */
  unknownAccountCodes: string[];
  /** Soft parse-time issues — see ParsedOsvResult.warnings. */
  parseWarnings: string[];
  /** Echo of the ОСВ title-block headers for the operator to verify the right file was uploaded. */
  companyHeader: string | null;
  periodHeader: string | null;
}

interface IngestArgs {
  organizationId: Types.ObjectId | string;
  periodId: Types.ObjectId | string;
  /** Absolute path to the .xls / .xlsx file. */
  filePath: string;
  /**
   * Free-text job/import id stored alongside the parsed result for traceability.
   * The ingestion service does NOT persist this in AccountBalance directly
   * (the schema has no slot for it) but logs it so it shows up in audit trails.
   */
  jobId?: string;
}

/**
 * Imports a 1C ОСВ export into AccountBalance rows on the NSBU_BASE layer
 * for the given org + reporting period.
 *
 * Replace strategy: FULL — every existing nsbu_base balance for the
 * (org, period) scope is deleted before the parsed rows are inserted. An
 * ОСВ file is a snapshot of the trial balance at a point in time; partial
 * imports merged into existing balances would let stale rows linger and
 * silently distort downstream layers. If the operator wants the
 * pre-existing rows kept, they should re-upload the original file or
 * (future) use a yet-to-be-built merge endpoint.
 *
 * What this service intentionally does NOT do:
 *   - Authorization. The caller (controller or job) is responsible for
 *     enforcing admin role + write-capability on the org.
 *   - Period status enforcement. A locked period should reject writes,
 *     but the rule lives in the controller / a pre-write hook (planned),
 *     not here.
 *   - Subconto-aware ingestion. Parsed rows are written with all subconto
 *     slots null. See osv-parser.ts for the deferred axis discussion.
 *
 * Subsequent layers (reclassification, adjustment, IFRS) are NOT touched.
 * Recomputing them is the responsibility of the transformation engine
 * once it's wired up to the ledger; for now those layers are seeded
 * empty after an ОСВ import.
 */
@Injectable()
export class OsvIngestionService {
  constructor(
    @InjectModel(AccountBalance.name)
    private readonly balanceModel: AccountBalanceModel,
    @InjectModel(ChartOfAccount.name)
    private readonly chartModel: ChartOfAccountModel,
    private readonly periods: PeriodsService,
    private readonly logger: AppLoggerService,
  ) {}

  async ingestFromFile(args: IngestArgs): Promise<OsvIngestionSummary> {
    const orgId =
      typeof args.organizationId === 'string'
        ? new Types.ObjectId(args.organizationId)
        : args.organizationId;
    const periodId =
      typeof args.periodId === 'string' ? new Types.ObjectId(args.periodId) : args.periodId;

    // Validate the period exists, belongs to the org, AND is writable (not
    // locked). PeriodsService throws 404 or 403 as appropriate — those flow
    // up to the controller as-is. The unique-index constraint on
    // AccountBalance would still catch cross-org or vanished periods, but a
    // clean 404/403 here gives a far better operator experience.
    const period = await this.periods.assertWritable(orgId, periodId);

    const parsed = parseOsv(args.filePath);

    if (parsed.rows.length === 0) {
      throw new BadRequestException({
        error: 'OSV_EMPTY',
        message: 'Parsed file contained no account rows',
      });
    }

    // Cross-check parsed codes against the chart of accounts. Unknown codes
    // are imported anyway but reported back to the operator.
    const codesInFile = new Set(parsed.rows.map((r) => r.code));
    const knownCharts = await this.chartModel
      .find({ organizationId: orgId, code: { $in: Array.from(codesInFile) } })
      .select('code')
      .lean();
    const knownCodes = new Set(knownCharts.map((c) => c.code));
    const unknownAccountCodes = Array.from(codesInFile).filter((c) => !knownCodes.has(c));

    // Full-replace mode — delete all nsbu_base balances for this period scope
    // so a re-import doesn't leak stale rows. RECLASSIFICATION / ADJUSTMENT /
    // IFRS layers are untouched.
    const purge = await this.balanceModel.deleteMany({
      organizationId: orgId,
      periodId,
      layer: BALANCE_LAYER.NSBU_BASE,
    });

    const now = new Date();
    const docs = parsed.rows.map((row) => this.rowToBalance(row, orgId, periodId, now));

    if (docs.length > 0) {
      await this.balanceModel.insertMany(docs, { ordered: false });
    }

    const summary: OsvIngestionSummary = {
      inserted: docs.length,
      replacedRows: purge.deletedCount ?? 0,
      unknownAccountCodes,
      parseWarnings: parsed.warnings,
      companyHeader: parsed.companyHeader,
      periodHeader: parsed.periodHeader,
    };

    this.logger.logAction('ledger.osv.imported', {
      orgId: orgId.toString(),
      periodId: periodId.toString(),
      periodLabel: period.label,
      jobId: args.jobId ?? null,
      ...summary,
      unknownAccountCount: unknownAccountCodes.length,
      // Don't ship the full list of unknown codes to the log if it gets long.
      unknownAccountCodes: unknownAccountCodes.slice(0, 20),
    });

    return summary;
  }

  /**
   * Pure mapping from a parsed ОСВ row to an AccountBalance document shape.
   * Exposed for unit testing — the rest of the service is I/O.
   */
  rowToBalance(
    row: ParsedOsvRow,
    organizationId: Types.ObjectId,
    periodId: Types.ObjectId,
    recomputedAt: Date,
  ) {
    return {
      organizationId,
      periodId,
      accountCode: row.code,
      layer: BALANCE_LAYER.NSBU_BASE,
      level: row.level,
      subconto1Value: null,
      subconto2Value: null,
      subconto3Value: null,
      counterpartyId: null,
      openingDebit: Types.Decimal128.fromString(row.openingDebit),
      openingCredit: Types.Decimal128.fromString(row.openingCredit),
      periodDebit: Types.Decimal128.fromString(row.periodDebit),
      periodCredit: Types.Decimal128.fromString(row.periodCredit),
      closingDebit: Types.Decimal128.fromString(row.closingDebit),
      closingCredit: Types.Decimal128.fromString(row.closingCredit),
      currency: null,
      quantity: null,
      source: 'osv_import' as const,
      recomputedAt,
    };
  }

  /**
   * Expose the parser via the service so callers don't have to import the
   * pure function directly. Useful for preview screens that want to show the
   * operator what was found before committing to a full ingestion.
   */
  parse(filePath: string): OsvParseResult {
    return parseOsv(filePath);
  }
}
