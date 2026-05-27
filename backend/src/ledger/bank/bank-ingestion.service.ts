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
import { BALANCE_LAYER } from '../constants/balance-layers';
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
} from '../schemas/journal-entry.schema';
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

    const parsed = parseBankStatement(args.filePath);

    if (parsed.rows.length === 0) {
      throw new BadRequestException({
        error: 'BANK_STATEMENT_EMPTY',
        message: 'Bank statement contained no transaction rows',
      });
    }

    const uploadId = crypto.randomUUID();
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
          actor: args.actor,
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

    const summary: BankIngestionSummary = {
      uploadId,
      draftsCreated: byColor.green + byColor.yellow + byColor.red,
      byColor,
      parseWarnings: parsed.warnings,
      rowsSkipped,
    };

    this.logger.logAction('ledger.bank.ingested', {
      orgId: orgId.toString(),
      periodId: periodId.toString(),
      actor: args.actor._id.toString(),
      ...summary,
    });

    return summary;
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
  }): Promise<Array<{
    entry: JournalEntryDocument;
    color: BankPreviewColor;
    reason: string;
  }>> {
    const orgId =
      typeof args.organizationId === 'string'
        ? new Types.ObjectId(args.organizationId)
        : args.organizationId;

    const entries = await this.entryModel
      .find({
        organizationId: orgId,
        source: 'bank_statement',
        status: 'draft',
        sourceRef: { $regex: `^bank:${this.escapeRegex(args.uploadId)}:` },
      })
      .sort({ date: 1, sourceRef: 1 });

    if (entries.length === 0) return [];

    // Bulk-load lines + counterparties so color derivation is one extra pair
    // of queries rather than N+1.
    const entryIds = entries.map((e) => e._id);
    const allLines = await this.lineModel
      .find({ entryId: { $in: entryIds } })
      .select('entryId accountCode counterpartyId')
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
      const hasPlaceholder = lines.some(
        (l) => l.accountCode === '000',
      );
      if (hasPlaceholder) {
        return {
          entry,
          color: 'red' as const,
          reason:
            'Unrecognized treasury payment — pick the record account before posting',
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
          };
        }
      }
      return { entry, color: 'green' as const, reason: '' };
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
      layer: BALANCE_LAYER.NSBU_BASE,
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
        layer: BALANCE_LAYER.NSBU_BASE,
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
        layer: BALANCE_LAYER.NSBU_BASE,
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

  private escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
