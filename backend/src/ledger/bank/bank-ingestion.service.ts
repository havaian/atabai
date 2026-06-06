import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as crypto from 'crypto';
import { Types, isValidObjectId } from 'mongoose';

import { AppLoggerService } from '../../common/logger/app-logger.service';
import type { UserDocument } from '../../users/schemas/user.schema';
import { isTreasuryInn } from '../constants/treasury';
import {
  ChartOfAccount,
  type ChartOfAccountModel,
} from '../schemas/chart-of-account.schema';
import {
  Counterparty,
  type CounterpartyModel,
} from '../schemas/counterparty.schema';
import {
  JournalEntryLine,
  type JournalEntryLineModel,
} from '../schemas/journal-entry-line.schema';
import {
  JournalEntry,
  type JournalEntryDocument,
  type JournalEntryModel,
  type JournalEntryStatus,
} from '../schemas/journal-entry.schema';
import {
  BankUploadJob,
  type BankUploadJobDocument,
  type BankUploadJobModel,
} from '../schemas/bank-upload-job.schema';
import { BalanceRollupService } from '../services/balance-rollup.service';
import { PeriodsService } from '../services/periods.service';
import { BANK_POSTING_ACCOUNTS } from './bank-accounts';
import { parseBankStatement, type ParsedBankRow } from './bank-parser';
import { CounterpartyResolverService } from './counterparty-resolver.service';
import { RunningBalanceService } from './running-balance.service';
import { TreasuryResolverService } from './treasury-resolver.service';

export type BankPreviewColor = 'green' | 'yellow' | 'red';

export interface BankIngestionSummary {
  uploadId: string;
  draftsCreated: number;
  byColor: Record<BankPreviewColor, number>;
  parseWarnings: string[];
  rowsSkipped: number;
}

interface IngestBankArgs {
  organizationId: Types.ObjectId | string;
  periodId: Types.ObjectId | string;
  filePath: string;
  actor: UserDocument;
  /** Original upload filename, recorded on the async job for the UI. */
  fileName?: string | null;
}

interface CommitDraftsArgs {
  organizationId: Types.ObjectId | string;
  periodId: Types.ObjectId | string;
  uploadId: string;
  actor: UserDocument;
}

/**
 * Bank-statement ingestion + posting orchestrator — bank ТЗ §3–§7.
 *
 * Per-row sequence:
 *   1. Resolve counterparty by ИНН (find or auto-create).
 *      - Auto-created → YELLOW.
 *   2. Decide direction by which of debitOut / creditIn is non-zero.
 *   3. If counterparty is treasury:
 *      - Look up TreasuryRule against `purpose` → use that record account.
 *      - No rule fires → RED, draft still created with placeholder until the
 *        operator picks an account manually.
 *   4. Otherwise post Scenario A/B per running balance:
 *      - A (debit out): payable open? Дт 6010 / Кт 5110. Else Дт 4310 / Кт 5110.
 *      - B (credit in): receivable open? Дт 5110 / Кт 4010. Else Дт 5110 / Кт 6310.
 *   5. Create a draft JournalEntry with two JournalEntryLines.
 *
 * The whole batch shares one `uploadId` — captured in `JournalEntry.sourceRef`
 * as `bank:{uploadId}:{rowIndex}` so a single statement's drafts can be listed
 * or rejected as a group.
 *
 * The running-balance lookup at step 4 excludes draft entries (see
 * RunningBalanceService docblock). This means processing the same statement
 * row-by-row produces consistent results — each row sees the "before" state,
 * not the partial in-flight state of preceding rows in the same batch.
 *
 * If a statement legitimately needs sequential balance dependence (rare —
 * usually each row clears a distinct payable / receivable), the operator
 * commits in batches: parse → review → commit subset → re-upload remaining.
 */
@Injectable()
export class BankIngestionService {
  constructor(
    @InjectModel(JournalEntry.name)
    private readonly entryModel: JournalEntryModel,
    @InjectModel(JournalEntryLine.name)
    private readonly lineModel: JournalEntryLineModel,
    @InjectModel(ChartOfAccount.name)
    private readonly chartModel: ChartOfAccountModel,
    @InjectModel(Counterparty.name)
    private readonly counterpartyModel: CounterpartyModel,
    @InjectModel(BankUploadJob.name)
    private readonly jobModel: BankUploadJobModel,
    private readonly periods: PeriodsService,
    private readonly counterparties: CounterpartyResolverService,
    private readonly treasury: TreasuryResolverService,
    private readonly runningBalance: RunningBalanceService,
    private readonly balanceRollup: BalanceRollupService,
    private readonly logger: AppLoggerService,
  ) {}

  // ─── Upload + parse + create drafts ────────────────────────────────────────

  async ingestFromFile(args: IngestBankArgs): Promise<BankIngestionSummary> {
    const orgId =
      typeof args.organizationId === 'string'
        ? new Types.ObjectId(args.organizationId)
        : args.organizationId;
    const periodId =
      typeof args.periodId === 'string'
        ? new Types.ObjectId(args.periodId)
        : args.periodId;

    await this.periods.assertWritable(orgId, periodId);

    const uploadId = crypto.randomUUID();
    const summary = await this.parseAndCreateDrafts(
      orgId,
      periodId,
      uploadId,
      args.filePath,
      args.actor,
    );

    this.logger.logAction('ledger.bank.ingested', {
      orgId: orgId.toString(),
      periodId: periodId.toString(),
      actor: args.actor._id.toString(),
      ...summary,
    });

    return summary;
  }

  /**
   * Start an asynchronous ingestion. Validates the period synchronously (so a
   * locked period fails fast with a 4xx), records a `processing` job, kicks
   * off the work in the background, and returns immediately with the job id
   * for the client to poll. See BankUploadJob schema for the rationale.
   */
  async startIngestion(args: IngestBankArgs): Promise<{
    uploadId: string;
    jobId: string;
    status: 'processing';
    fileName: string | null;
  }> {
    const orgId =
      typeof args.organizationId === 'string'
        ? new Types.ObjectId(args.organizationId)
        : args.organizationId;
    const periodId =
      typeof args.periodId === 'string'
        ? new Types.ObjectId(args.periodId)
        : args.periodId;

    // Fail fast on a locked period — before creating a job or returning.
    await this.periods.assertWritable(orgId, periodId);

    const uploadId = crypto.randomUUID();
    const job = await this.jobModel.create({
      organizationId: orgId,
      periodId,
      uploadId,
      status: 'processing',
      fileName: args.fileName ?? null,
      createdBy: args.actor._id,
    });

    // Fire-and-forget: the work runs after the response is sent. Any failure
    // is captured onto the job document inside runIngestion, so the floating
    // promise never throws unhandled. The extra .catch is a belt-and-braces
    // guard against an error escaping the job update itself.
    void this.runIngestion(job._id, orgId, periodId, uploadId, args).catch((err) => {
      this.logger.error(err, {
        context: 'BankIngestionService.runIngestion',
        jobId: job._id.toString(),
        uploadId,
      });
    });

    return {
      uploadId,
      jobId: job._id.toString(),
      status: 'processing',
      fileName: job.fileName,
    };
  }

  /**
   * Background body for startIngestion. Parses + creates drafts, then writes
   * the outcome onto the job: `completed` with the summary, or `failed` with a
   * reason. Never throws to the caller — startIngestion fired this without
   * awaiting.
   */
  private async runIngestion(
    jobId: Types.ObjectId,
    orgId: Types.ObjectId,
    periodId: Types.ObjectId,
    uploadId: string,
    args: IngestBankArgs,
  ): Promise<void> {
    try {
      const summary = await this.parseAndCreateDrafts(
        orgId,
        periodId,
        uploadId,
        args.filePath,
        args.actor,
      );

      await this.jobModel.updateOne(
        { _id: jobId },
        { $set: { status: 'completed', summary, error: null } },
      );

      this.logger.logAction('ledger.bank.ingested', {
        orgId: orgId.toString(),
        periodId: periodId.toString(),
        actor: args.actor._id.toString(),
        jobId: jobId.toString(),
        ...summary,
      });
    } catch (err) {
      const message =
        (err as { response?: { message?: string } }).response?.message ||
        (err as Error).message ||
        'Bank statement processing failed';
      await this.jobModel.updateOne(
        { _id: jobId },
        { $set: { status: 'failed', error: message } },
      );
      this.logger.error(err, {
        context: 'BankIngestionService.runIngestion',
        jobId: jobId.toString(),
        uploadId,
      });
    }
  }

  /**
   * Fetch a job's status for the polling endpoint. Org-scoped so one tenant
   * can't read another's job.
   */
  async getJob(
    organizationId: Types.ObjectId | string,
    jobId: string,
  ): Promise<BankUploadJobDocument> {
    const orgId =
      typeof organizationId === 'string'
        ? new Types.ObjectId(organizationId)
        : organizationId;
    if (!isValidObjectId(jobId)) {
      throw new NotFoundException({
        error: 'UPLOAD_JOB_NOT_FOUND',
        message: 'Upload job not found',
      });
    }
    const job = await this.jobModel.findOne({
      _id: new Types.ObjectId(jobId),
      organizationId: orgId,
    });
    if (!job) {
      throw new NotFoundException({
        error: 'UPLOAD_JOB_NOT_FOUND',
        message: 'Upload job not found',
      });
    }
    return job;
  }

  /**
   * Shared core: parse the file and create a draft per row. No period
   * validation, no logging, no job bookkeeping — those belong to the callers
   * (ingestFromFile for the synchronous path, runIngestion for the async one).
   */
  private async parseAndCreateDrafts(
    orgId: Types.ObjectId,
    periodId: Types.ObjectId,
    uploadId: string,
    filePath: string,
    actor: UserDocument,
  ): Promise<BankIngestionSummary> {
    const parsed = parseBankStatement(filePath);

    if (parsed.rows.length === 0) {
      throw new BadRequestException({
        error: 'BANK_STATEMENT_EMPTY',
        message: 'Bank statement contained no transaction rows',
      });
    }

    const byColor: Record<BankPreviewColor, number> = {
      green: 0,
      yellow: 0,
      red: 0,
    };
    let rowsSkipped = 0;

    for (const row of parsed.rows) {
      try {
        const color = await this.createDraftForRow({
          orgId,
          periodId,
          uploadId,
          row,
          actor,
        });
        byColor[color]++;
      } catch (err) {
        rowsSkipped++;
        this.logger.error(err, {
          context: 'BankIngestionService.createDraftForRow',
          uploadId,
          sourceRow: row.sourceRow,
        });
      }
    }

    return {
      uploadId,
      draftsCreated: byColor.green + byColor.yellow + byColor.red,
      byColor,
      parseWarnings: parsed.warnings,
      rowsSkipped,
    };
  }

  // ─── List drafts for a batch (preview screen) ───────────────────────────────

  /**
   * Enriched draft listing for the bank-preview screen (bank ТЗ §7).
   *
   * Each draft is returned with a server-derived `color`:
   *   - RED    — at least one line carries the placeholder account '000'.
   *              These are gated against commit until the operator fixes them.
   *   - YELLOW — the draft's counterparty was auto-created from a bank row
   *              and hasn't been verified yet. Posts fine but worth a glance.
   *   - GREEN  — known counterparty + real account. Will commit as-is.
   *
   * Deriving the color server-side (rather than in the UI) keeps the
   * frontend a thin presenter and means a CLI / future native client gets
   * the same labels for free.
   */
  async listDraftsForUpload(args: {
    organizationId: Types.ObjectId | string;
    uploadId: string;
    /**
     * Which entry statuses to include. Defaults to ['draft'] so the live
     * preview screen behaves exactly as before. The batch-history view
     * passes ['committed'] (or omits the filter) to inspect a batch that
     * has already been posted, read-only.
     */
    statuses?: JournalEntryStatus[];
  }): Promise<Array<{
    entry: JournalEntryDocument;
    color: BankPreviewColor;
    reason: string;
    recordAccount: string | null;
    direction: 'we_pay' | 'we_receive' | null;
  }>> {
    const orgId =
      typeof args.organizationId === 'string'
        ? new Types.ObjectId(args.organizationId)
        : args.organizationId;

    const statusFilter =
      args.statuses && args.statuses.length > 0 ? args.statuses : ['draft'];

    const entries = await this.entryModel
      .find({
        organizationId: orgId,
        source: 'bank_statement',
        status: { $in: statusFilter },
        sourceRef: { $regex: `^bank:${this.escapeRegex(args.uploadId)}:` },
      })
      .sort({ date: 1, sourceRef: 1 });

    if (entries.length === 0) return [];

    // Bulk-load lines + counterparties so color derivation is one extra pair
    // of queries rather than N+1.
    const entryIds = entries.map((e) => e._id);
    const allLines = await this.lineModel
      .find({ entryId: { $in: entryIds } })
      .select('entryId accountCode counterpartyId direction')
      .lean();
    const linesByEntryId = new Map<string, typeof allLines>();
    for (const line of allLines) {
      const key = line.entryId.toString();
      const bucket = linesByEntryId.get(key);
      if (bucket) bucket.push(line);
      else linesByEntryId.set(key, [line]);
    }

    const counterpartyIds = Array.from(
      new Set(
        allLines
          .map((l) => l.counterpartyId?.toString())
          .filter((id): id is string => typeof id === 'string'),
      ),
    );
    const counterparties =
      counterpartyIds.length > 0
        ? await this.counterpartyModel
              .find({ _id: { $in: counterpartyIds.map((id) => new Types.ObjectId(id)) } })
              .select('_id createdFromBankRow')
              .lean()
        : [];
    const cpartyById = new Map(
      counterparties.map((c) => [c._id.toString(), c]),
    );

    return entries.map((entry) => {
      const lines = linesByEntryId.get(entry._id.toString()) ?? [];
      // The "record" leg is whichever line is NOT the org's current account
      // (5110). Direction: if the record account is on the debit side we paid
      // out; if on the credit side money came in.
      const recordLine =
        lines.find((l) => l.accountCode !== BANK_POSTING_ACCOUNTS.CURRENT_ACCOUNT) ?? null;
      const recordAccount = recordLine?.accountCode ?? null;
      const direction: 'we_pay' | 'we_receive' | null = recordLine
        ? recordLine.direction === 'debit'
          ? 'we_pay'
          : 'we_receive'
        : null;

      const hasPlaceholder = lines.some(
        (l) => l.accountCode === '000',
      );
      if (hasPlaceholder) {
        return {
          entry,
          color: 'red' as const,
          reason:
            'Unrecognized treasury payment — pick the record account before posting',
          recordAccount,
          direction,
        };
      }
      const counterpartyId = lines.find((l) => l.counterpartyId)?.counterpartyId;
      if (counterpartyId) {
        const cparty = cpartyById.get(counterpartyId.toString());
        if (cparty?.createdFromBankRow) {
          return {
            entry,
            color: 'yellow' as const,
            reason: 'Counterparty auto-created from this statement — verify',
            recordAccount,
            direction,
          };
        }
      }
      return { entry, color: 'green' as const, reason: '', recordAccount, direction };
    });
  }

  // ─── Commit ────────────────────────────────────────────────────────────────

  async commitDrafts(args: CommitDraftsArgs): Promise<{
    committed: number;
    skipped: number;
    rolledUpKeys: number;
  }> {
    const orgId =
      typeof args.organizationId === 'string'
        ? new Types.ObjectId(args.organizationId)
        : args.organizationId;
    const periodId =
      typeof args.periodId === 'string'
        ? new Types.ObjectId(args.periodId)
        : args.periodId;

    await this.periods.assertWritable(orgId, periodId);

    const drafts = await this.entryModel.find({
      organizationId: orgId,
      periodId,
      source: 'bank_statement',
      status: 'draft',
      sourceRef: { $regex: `^bank:${this.escapeRegex(args.uploadId)}:` },
    });

    let committed = 0;
    let skipped = 0;
    const committedEntries: typeof drafts = [];
    const now = new Date();

    for (const draft of drafts) {
      // RED drafts (any line on the placeholder '000' account) must be
      // resolved before they can be committed. The operator-fix endpoint
      // is a follow-up slice; for now we just skip them so the commit
      // doesn't half-fail.
      const lines = await this.lineModel.find({ entryId: draft._id }).lean();
      if (lines.some((l) => l.accountCode === '000')) {
        skipped++;
        continue;
      }

      draft.status = 'committed';
      draft.committedAt = now;
      draft.committedBy = args.actor._id;
      await draft.save();
      committedEntries.push(draft);
      committed++;
    }

    // Materialize AccountBalance rows for every key the committed batch
    // touched. Without this, the journal entries are stored but
    // downstream balance queries don't see them — which is exactly the
    // "spine proves end-to-end" claim §9 makes for the bank engine.
    const rollup = await this.balanceRollup.rollupForEntries(committedEntries);

    this.logger.logAction('ledger.bank.committed', {
      orgId: orgId.toString(),
      periodId: periodId.toString(),
      uploadId: args.uploadId,
      actor: args.actor._id.toString(),
      committed,
      skipped,
      rolledUpKeys: rollup.affectedKeys.length,
      rolledUpRecomputed: rollup.recomputed,
      rolledUpCreated: rollup.created,
    });

    return { committed, skipped, rolledUpKeys: rollup.affectedKeys.length };
  }

  // ─── Edit a draft (operator fixes a RED row in the preview UI) ──────────────

  async updateDraft(args: {
    organizationId: Types.ObjectId | string;
    periodId: Types.ObjectId | string;
    uploadId: string;
    entryId: string;
    patch: {
      accountCode?: string;
      counterpartyId?: string;
      description?: string;
    };
    actor: UserDocument;
  }): Promise<JournalEntryDocument> {
    if (
      args.patch.accountCode === undefined &&
      args.patch.counterpartyId === undefined &&
      args.patch.description === undefined
    ) {
      throw new BadRequestException({
        error: 'EMPTY_PATCH',
        message: 'Provide at least one of: accountCode, counterpartyId, description',
      });
    }

    const orgId =
      typeof args.organizationId === 'string'
        ? new Types.ObjectId(args.organizationId)
        : args.organizationId;
    const periodId =
      typeof args.periodId === 'string'
        ? new Types.ObjectId(args.periodId)
        : args.periodId;

    await this.periods.assertWritable(orgId, periodId);

    if (!isValidObjectId(args.entryId)) {
      throw new NotFoundException({
        error: 'DRAFT_NOT_FOUND',
        message: 'Draft entry not found',
      });
    }
    const entry = await this.entryModel.findOne({
      _id: new Types.ObjectId(args.entryId),
      organizationId: orgId,
      periodId,
      source: 'bank_statement',
      status: 'draft',
      sourceRef: { $regex: `^bank:${this.escapeRegex(args.uploadId)}:` },
    });
    if (!entry) {
      throw new NotFoundException({
        error: 'DRAFT_NOT_FOUND',
        message: 'Draft entry not found in this upload batch',
      });
    }

    // Validate referenced account / counterparty before any writes so we
    // either apply the full patch or reject it cleanly.
    if (args.patch.accountCode !== undefined) {
      const chartHit = await this.chartModel
        .findOne({ organizationId: orgId, code: args.patch.accountCode, isActive: true })
        .lean();
      if (!chartHit) {
        throw new BadRequestException({
          error: 'UNKNOWN_ACCOUNT',
          message: `Account ${args.patch.accountCode} not found in this organization's chart`,
        });
      }
    }

    let counterpartyObjectId: Types.ObjectId | null = null;
    if (args.patch.counterpartyId !== undefined) {
      if (!isValidObjectId(args.patch.counterpartyId)) {
        throw new BadRequestException({
          error: 'INVALID_COUNTERPARTY_ID',
          message: 'counterpartyId is not a valid id',
        });
      }
      counterpartyObjectId = new Types.ObjectId(args.patch.counterpartyId);
      const cpartyHit = await this.counterpartyModel
        .findOne({ _id: counterpartyObjectId, organizationId: orgId })
        .lean();
      if (!cpartyHit) {
        throw new BadRequestException({
          error: 'UNKNOWN_COUNTERPARTY',
          message: 'Counterparty not found in this organization',
        });
      }
    }

    // Apply patch — entry first, then lines.
    if (args.patch.description !== undefined) {
      entry.description = args.patch.description.substring(0, 1990);
      await entry.save();
    }

    const lines = await this.lineModel.find({ entryId: entry._id });

    // The "record-side" line is whichever isn't the org's current account
    // (5110). For a bank-engine draft there's exactly one of each. Updating
    // accountCode replaces that side; the 5110 side stays put.
    const recordLine = lines.find(
      (l) => l.accountCode !== BANK_POSTING_ACCOUNTS.CURRENT_ACCOUNT,
    );
    if (!recordLine && args.patch.accountCode !== undefined) {
      // Shouldn't happen for bank-engine drafts but surfaces clearly if it does.
      throw new BadRequestException({
        error: 'NO_RECORD_LINE',
        message:
          'Could not identify the record-side line on this draft — entry may have been hand-edited into an unsupported shape',
      });
    }

    if (args.patch.accountCode !== undefined && recordLine) {
      recordLine.accountCode = args.patch.accountCode;
      await recordLine.save();
    }

    if (args.patch.counterpartyId !== undefined) {
      // Both lines reference the counterparty on bank-engine drafts —
      // update both to keep the audit trail consistent.
      for (const line of lines) {
        line.counterpartyId = counterpartyObjectId;
        line.subconto1Value = counterpartyObjectId
          ? counterpartyObjectId.toString()
          : null;
        await line.save();
      }
    }

    this.logger.logAction('ledger.bank.draft_edited', {
      orgId: orgId.toString(),
      periodId: periodId.toString(),
      uploadId: args.uploadId,
      entryId: entry._id.toString(),
      actor: args.actor._id.toString(),
      patchKeys: Object.keys(args.patch).filter(
        (k) => args.patch[k as keyof typeof args.patch] !== undefined,
      ),
    });

    return entry;
  }

  // ─── Internal: per-row draft creation ───────────────────────────────────────

  private async createDraftForRow(args: {
    orgId: Types.ObjectId;
    periodId: Types.ObjectId;
    uploadId: string;
    row: ParsedBankRow;
    actor: UserDocument;
  }): Promise<BankPreviewColor> {
    const { orgId, periodId, uploadId, row, actor } = args;

    // 1. Counterparty resolution.
    const resolved = await this.counterparties.resolve({
      organizationId: orgId,
      inn: row.inn,
      fallbackName: row.counterpartyName,
      accountNumber: row.counterpartyAccount,
      bankCode: row.bankCode,
    });

    let counterpartyId: Types.ObjectId | null = null;
    let autoCreated = false;
    if (resolved) {
      counterpartyId = resolved.counterparty._id;
      autoCreated = resolved.autoCreated;
    }

    // 2. Direction.
    const direction = this.deriveDirection(row);
    if (!direction) {
      // The parser already warned; bail without creating a draft.
      throw new Error(
        `Row ${row.sourceRow}: both debitOut and creditIn are zero — cannot derive direction`,
      );
    }
    const amount = direction === 'we_pay' ? row.debitOut : row.creditIn;

    // 3. Treasury path?
    let recordAccount: string | null = null;
    let color: BankPreviewColor = 'green';
    let needsManual = false;
    let treasuryMatchedOn: string | null = null;

    if (row.inn && isTreasuryInn(row.inn)) {
      const treasury = await this.treasury.resolve({
        organizationId: orgId,
        purpose: row.purpose,
      });
      if (treasury) {
        recordAccount = treasury.recordAccountCode;
        treasuryMatchedOn = treasury.matchedOn;
      } else {
        // RED: operator must pick account.
        recordAccount = '000';
        needsManual = true;
        color = 'red';
      }
    } else if (counterpartyId) {
      // 4. Standard Scenario A / B per running balance.
      recordAccount = await this.pickStandardRecordAccount({
        orgId,
        periodId,
        counterpartyId,
        direction,
      });
    } else {
      // No counterparty resolved (no ИНН, no account match) AND not treasury.
      // RED — operator picks counterparty and account.
      recordAccount = '000';
      needsManual = true;
      color = 'red';
    }

    if (!needsManual && autoCreated) color = 'yellow';

    // 5. Create the draft entry + 2 lines.
    const entry = await this.entryModel.create({
      organizationId: orgId,
      periodId,
      date: row.date,
      description: row.purpose.substring(0, 1990),
      source: 'bank_statement',
      sourceRef: `bank:${uploadId}:${row.sourceRow}`,
      status: 'draft',
      totalAmount: Types.Decimal128.fromString(amount),
      createdBy: actor._id,
    });

    const debitAccount =
      direction === 'we_pay' ? recordAccount : BANK_POSTING_ACCOUNTS.CURRENT_ACCOUNT;
    const creditAccount =
      direction === 'we_pay' ? BANK_POSTING_ACCOUNTS.CURRENT_ACCOUNT : recordAccount;

    await this.lineModel.create([
      {
        entryId: entry._id,
        organizationId: orgId,
        periodId,
        date: row.date,
        accountCode: debitAccount,
        direction: 'debit',
        amount: Types.Decimal128.fromString(amount),
        counterpartyId,
        subconto1Value: counterpartyId ? counterpartyId.toString() : null,
        description: this.lineDescription(row, treasuryMatchedOn, 'debit'),
      },
      {
        entryId: entry._id,
        organizationId: orgId,
        periodId,
        date: row.date,
        accountCode: creditAccount,
        direction: 'credit',
        amount: Types.Decimal128.fromString(amount),
        counterpartyId,
        subconto1Value: counterpartyId ? counterpartyId.toString() : null,
        description: this.lineDescription(row, treasuryMatchedOn, 'credit'),
      },
    ]);

    return color;
  }

  private deriveDirection(row: ParsedBankRow): 'we_pay' | 'we_receive' | null {
    const hasDebit = row.debitOut !== '0';
    const hasCredit = row.creditIn !== '0';
    if (hasDebit && !hasCredit) return 'we_pay';
    if (hasCredit && !hasDebit) return 'we_receive';
    return null;
  }

  private async pickStandardRecordAccount(args: {
    orgId: Types.ObjectId;
    periodId: Types.ObjectId;
    counterpartyId: Types.ObjectId;
    direction: 'we_pay' | 'we_receive';
  }): Promise<string> {
    const { orgId, periodId, counterpartyId, direction } = args;

    if (direction === 'we_pay') {
      // Scenario A — bank ТЗ §6.
      const hasPayable = await this.runningBalance.hasOpenPayable({
        organizationId: orgId,
        periodId,
        accountCode: BANK_POSTING_ACCOUNTS.ACCOUNTS_PAYABLE,
        counterpartyId,
      });
      return hasPayable
        ? BANK_POSTING_ACCOUNTS.ACCOUNTS_PAYABLE
        : BANK_POSTING_ACCOUNTS.ADVANCES_ISSUED;
    }

    // Scenario B.
    const hasReceivable = await this.runningBalance.hasOpenReceivable({
      organizationId: orgId,
      periodId,
      accountCode: BANK_POSTING_ACCOUNTS.ACCOUNTS_RECEIVABLE,
      counterpartyId,
    });
    return hasReceivable
      ? BANK_POSTING_ACCOUNTS.ACCOUNTS_RECEIVABLE
      : BANK_POSTING_ACCOUNTS.ADVANCES_RECEIVED;
  }

  private lineDescription(
    row: ParsedBankRow,
    treasuryMatchedOn: string | null,
    side: 'debit' | 'credit',
  ): string {
    const base = `Bank row ${row.sourceRow} — ${row.counterpartyName}`;
    if (treasuryMatchedOn) {
      return `${base} (treasury rule matched on ${treasuryMatchedOn}) [${side}]`;
    }
    return `${base} [${side}]`;
  }

  // ─── List upload batches for a period (batch-history screen) ────────────────

  /**
   * Aggregate every bank-statement entry in a period into one row per upload
   * batch. There is no separate "upload" collection — each upload's identity
   * lives only in the `sourceRef` (`bank:{uploadId}:{rowIndex}`), so we group
   * by the embedded uploadId here.
   *
   * Per batch we report: total rows, a per-status breakdown, the green/yellow/
   * red breakdown of the still-draft rows (so the list can show how much is
   * left to fix), and the earliest createdAt as the batch's "uploaded at".
   *
   * This is what makes a batch reachable again after the operator closes the
   * preview tab — the uploadId is otherwise lost (it only ever lived in the
   * preview URL).
   */
  async listBatchesForPeriod(args: {
    organizationId: Types.ObjectId | string;
    periodId: Types.ObjectId | string;
  }): Promise<
    Array<{
      uploadId: string;
      uploadedAt: Date | null;
      totalRows: number;
      statusCounts: Record<JournalEntryStatus, number>;
      draftColorCounts: Record<BankPreviewColor, number>;
    }>
  > {
    const orgId =
      typeof args.organizationId === 'string'
        ? new Types.ObjectId(args.organizationId)
        : args.organizationId;
    const periodId =
      typeof args.periodId === 'string'
        ? new Types.ObjectId(args.periodId)
        : args.periodId;

    // Pull the lean fields we need for every bank entry in the period, plus
    // the placeholder-account signal (whether any line is '000' → RED) so the
    // draft color breakdown can be computed without an N+1 over batches.
    const entries = await this.entryModel
      .find({
        organizationId: orgId,
        periodId,
        source: 'bank_statement',
        sourceRef: { $regex: '^bank:' },
      })
      .select('_id sourceRef status createdAt')
      .lean();

    if (entries.length === 0) return [];

    // Map entryId → has a '000' placeholder line (RED). One bulk query.
    const entryIds = entries.map((e) => e._id);
    const placeholderLines = await this.lineModel
      .find({ entryId: { $in: entryIds }, accountCode: '000' })
      .select('entryId')
      .lean();
    const redEntryIds = new Set(placeholderLines.map((l) => l.entryId.toString()));

    // Counterparty auto-created signal (YELLOW) for the remaining draft rows.
    const draftLineEntryIds = entries
      .filter((e) => e.status === 'draft' && !redEntryIds.has(e._id.toString()))
      .map((e) => e._id);
    const draftLines =
      draftLineEntryIds.length > 0
        ? await this.lineModel
            .find({ entryId: { $in: draftLineEntryIds }, counterpartyId: { $ne: null } })
            .select('entryId counterpartyId')
            .lean()
        : [];
    const cpartyIds = Array.from(
      new Set(
        draftLines
          .map((l) => l.counterpartyId?.toString())
          .filter((id): id is string => typeof id === 'string'),
      ),
    );
    const autoCreatedCparties =
      cpartyIds.length > 0
        ? await this.counterpartyModel
            .find({
              _id: { $in: cpartyIds.map((id) => new Types.ObjectId(id)) },
              createdFromBankRow: true,
            })
            .select('_id')
            .lean()
        : [];
    const autoCreatedSet = new Set(autoCreatedCparties.map((c) => c._id.toString()));
    // entryId → is yellow (first counterparty line is auto-created).
    const yellowEntryIds = new Set<string>();
    for (const line of draftLines) {
      const cpId = line.counterpartyId?.toString();
      if (cpId && autoCreatedSet.has(cpId)) {
        yellowEntryIds.add(line.entryId.toString());
      }
    }

    // Group by uploadId parsed out of `bank:{uploadId}:{rowIndex}`.
    const batches = new Map<
      string,
      {
        uploadId: string;
        uploadedAt: Date | null;
        totalRows: number;
        statusCounts: Record<JournalEntryStatus, number>;
        draftColorCounts: Record<BankPreviewColor, number>;
      }
    >();

    for (const e of entries) {
      const ref = e.sourceRef ?? '';
      const parts = ref.split(':'); // ['bank', uploadId, rowIndex]
      const uploadId = parts[1];
      if (!uploadId) continue;

      let batch = batches.get(uploadId);
      if (!batch) {
        batch = {
          uploadId,
          uploadedAt: null,
          totalRows: 0,
          statusCounts: { draft: 0, committed: 0, reversed: 0 },
          draftColorCounts: { green: 0, yellow: 0, red: 0 },
        };
        batches.set(uploadId, batch);
      }

      batch.totalRows += 1;
      batch.statusCounts[e.status] = (batch.statusCounts[e.status] ?? 0) + 1;

      const created = (e as unknown as { createdAt?: Date }).createdAt ?? null;
      if (created && (!batch.uploadedAt || created < batch.uploadedAt)) {
        batch.uploadedAt = created;
      }

      if (e.status === 'draft') {
        const id = e._id.toString();
        if (redEntryIds.has(id)) batch.draftColorCounts.red += 1;
        else if (yellowEntryIds.has(id)) batch.draftColorCounts.yellow += 1;
        else batch.draftColorCounts.green += 1;
      }
    }

    // Newest upload first.
    return Array.from(batches.values()).sort((a, b) => {
      const at = a.uploadedAt ? a.uploadedAt.getTime() : 0;
      const bt = b.uploadedAt ? b.uploadedAt.getTime() : 0;
      return bt - at;
    });
  }

  private escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
