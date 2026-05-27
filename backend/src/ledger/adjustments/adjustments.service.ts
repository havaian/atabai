import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Types, isValidObjectId } from 'mongoose';

import { AppLoggerService } from '../../common/logger/app-logger.service';
import type { UserDocument } from '../../users/schemas/user.schema';
import { BALANCE_LAYER } from '../constants/balance-layers';
import {
  addDecimals,
  compareDecimals,
  isPositive,
  negateDecimal,
  toDecimal128,
} from '../decimal-arithmetic';
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
  type LineDirection,
} from '../schemas/journal-entry-line.schema';
import {
  JournalEntry,
  type JournalEntryDocument,
  type JournalEntryModel,
} from '../schemas/journal-entry.schema';
import { BalanceRollupService } from '../services/balance-rollup.service';
import { PeriodsService } from '../services/periods.service';

export interface AdjustmentLineInput {
  accountCode: string;
  direction: LineDirection;
  /** Decimal string, non-negative. */
  amount: string;
  counterpartyId?: string | null;
  subconto1Value?: string | null;
  subconto2Value?: string | null;
  subconto3Value?: string | null;
  description?: string;
}

export interface AdjustmentMetaInput {
  /** IFRS standard tag — IAS_16 / IFRS_16 / IFRS_9 / IFRS_15 / IAS_12 etc. */
  standard: string;
  reason: string;
  /** Decimal string. Signed amount the deferred-tax sweep will pick up. "0" when N/A. */
  taxEffectAmount?: string;
  disclosureText?: string;
}

export interface CreateAdjustmentArgs {
  organizationId: Types.ObjectId | string;
  periodId: Types.ObjectId | string;
  date: Date;
  description?: string;
  adjustmentMeta: AdjustmentMetaInput;
  lines: AdjustmentLineInput[];
  /** Optional free-text source pointer for the audit trail. */
  sourceRef?: string | null;
  actor: UserDocument;
}

export interface ReverseAdjustmentArgs {
  organizationId: Types.ObjectId | string;
  entryId: string;
  reason: string;
  actor: UserDocument;
}

/**
 * Adjustments engine — architecture doc §4.1 step 4 and §7.2.
 *
 * The IFRS overlay layer. Every adjustment is a JournalEntry on
 * `layer: 'adjustment'` carrying `adjustmentMeta` (standard + reason +
 * deferred-tax effect + disclosure text). The NSBU base layer is never
 * touched — that immutability is the trust proposition stated in §7.2.
 *
 * The service intentionally ships generic infrastructure here; per doc §9
 * "Adjustments, one IFRS standard at a time, each behind specialist sign-off"
 * means standard-specific computations (depreciation method swap for IAS 16,
 * right-of-use recognition for IFRS 16, ECL provisioning for IFRS 9,
 * control-transfer timing for IFRS 15) land as separate domain services
 * downstream that USE this engine to actually post the journal entries.
 *
 * Sign-off model: a Membership with `ifrs.overlay.write` capability can
 * both draft and commit. The two-step flow (draft → commit) is enforced by
 * the JournalEntry.status machine; a more granular "operator drafts,
 * specialist commits" split is a future capability addition. The doc's
 * "specialist sign-off" is satisfied because adjustments are gated on the
 * IFRS specialist capability throughout.
 *
 * Reversal: append-only. Reversing a committed adjustment creates a NEW
 * entry with sign-flipped lines and `reversesEntryId` pointing back. The
 * original entry stays in the ledger; both contribute to the rollup, and
 * the net effect on AccountBalance is zero.
 */
@Injectable()
export class AdjustmentsService {
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
    private readonly balanceRollup: BalanceRollupService,
    private readonly logger: AppLoggerService,
  ) {}

  // ─── Create ────────────────────────────────────────────────────────────────

  async createDraft(args: CreateAdjustmentArgs): Promise<JournalEntryDocument> {
    const orgId = this.asObjectId(args.organizationId);
    const periodId = this.asObjectId(args.periodId);

    await this.periods.assertWritable(orgId, periodId);
    this.validateMeta(args.adjustmentMeta);
    await this.validateLines(orgId, args.lines);

    const total = this.assertBalanced(args.lines);

    const entry = await this.entryModel.create({
      organizationId: orgId,
      periodId,
      date: args.date,
      description: (args.description ?? '').substring(0, 1990),
      source: 'adjustment',
      sourceRef: args.sourceRef ?? null,
      layer: BALANCE_LAYER.ADJUSTMENT,
      status: 'draft',
      totalAmount: toDecimal128(total),
      adjustmentMeta: {
        standard: args.adjustmentMeta.standard.trim(),
        reason: args.adjustmentMeta.reason.trim(),
        taxEffectAmount: toDecimal128(args.adjustmentMeta.taxEffectAmount ?? '0'),
        disclosureText: (args.adjustmentMeta.disclosureText ?? '').trim(),
      },
      createdBy: args.actor._id,
    });

    await this.createLines(entry, args.lines, orgId, periodId);

    this.logger.logAction('ledger.adjustment.drafted', {
      orgId: orgId.toString(),
      periodId: periodId.toString(),
      entryId: entry._id.toString(),
      standard: args.adjustmentMeta.standard,
      totalAmount: total,
      lineCount: args.lines.length,
      actor: args.actor._id.toString(),
    });

    return entry;
  }

  // ─── Commit ────────────────────────────────────────────────────────────────

  async commitDraft(args: {
    organizationId: Types.ObjectId | string;
    entryId: string;
    actor: UserDocument;
  }): Promise<JournalEntryDocument> {
    const orgId = this.asObjectId(args.organizationId);
    const entry = await this.requireDraftAdjustment(orgId, args.entryId);

    await this.periods.assertWritable(orgId, entry.periodId);

    entry.status = 'committed';
    entry.committedAt = new Date();
    entry.committedBy = args.actor._id;
    await entry.save();

    const rollup = await this.balanceRollup.rollupForEntries([entry]);

    this.logger.logAction('ledger.adjustment.committed', {
      orgId: orgId.toString(),
      entryId: entry._id.toString(),
      standard: entry.adjustmentMeta?.standard,
      rolledUpKeys: rollup.affectedKeys.length,
      actor: args.actor._id.toString(),
    });

    return entry;
  }

  // ─── Reverse ───────────────────────────────────────────────────────────────

  /**
   * Create a sign-flipped counter-entry. The original stays in the ledger
   * (append-only); their sum on AccountBalance after rollup is zero.
   */
  async reverseEntry(args: ReverseAdjustmentArgs): Promise<JournalEntryDocument> {
    const orgId = this.asObjectId(args.organizationId);

    if (!isValidObjectId(args.entryId)) {
      throw new NotFoundException({
        error: 'ADJUSTMENT_NOT_FOUND',
        message: 'Adjustment entry not found',
      });
    }
    const original = await this.entryModel.findOne({
      _id: new Types.ObjectId(args.entryId),
      organizationId: orgId,
      source: 'adjustment',
    });
    if (!original) {
      throw new NotFoundException({
        error: 'ADJUSTMENT_NOT_FOUND',
        message: 'Adjustment entry not found',
      });
    }
    if (original.status !== 'committed') {
      throw new BadRequestException({
        error: 'NOT_COMMITTED',
        message: 'Only committed adjustments can be reversed',
      });
    }
    if (original.reversesEntryId !== null) {
      throw new BadRequestException({
        error: 'ALREADY_A_REVERSAL',
        message: 'Cannot reverse a reversal entry',
      });
    }

    await this.periods.assertWritable(orgId, original.periodId);

    if (!args.reason || args.reason.trim().length === 0) {
      throw new BadRequestException({
        error: 'REASON_REQUIRED',
        message: 'Reversal requires a reason — it carries forward into the audit trail',
      });
    }

    const originalLines = await this.lineModel.find({ entryId: original._id });

    // Build flipped lines. Direction swap; amount unchanged. Subconto + counterparty preserved.
    const flippedLines: AdjustmentLineInput[] = originalLines.map((l) => ({
      accountCode: l.accountCode,
      direction: l.direction === 'debit' ? 'credit' : 'debit',
      amount: l.amount.toString(),
      counterpartyId: l.counterpartyId ? l.counterpartyId.toString() : null,
      subconto1Value: l.subconto1Value,
      subconto2Value: l.subconto2Value,
      subconto3Value: l.subconto3Value,
      description: `Reversal of ${l.description ?? ''}`.substring(0, 990),
    }));

    const total = this.assertBalanced(flippedLines);

    const reversal = await this.entryModel.create({
      organizationId: orgId,
      periodId: original.periodId,
      date: new Date(),
      description: `Reversal of ${original._id.toString()} — ${args.reason.trim()}`.substring(0, 1990),
      source: 'adjustment',
      sourceRef: original.sourceRef
        ? `reversal:${original.sourceRef}`
        : `reversal:${original._id.toString()}`,
      layer: BALANCE_LAYER.ADJUSTMENT,
      status: 'committed',
      totalAmount: toDecimal128(total),
      adjustmentMeta: {
        standard: original.adjustmentMeta?.standard ?? 'reversal',
        reason: `Reversal: ${args.reason.trim()}`,
        // Flip the sign of the original tax effect — the deferred-tax sweep
        // will see the net of original + reversal as zero, which is correct.
        taxEffectAmount: original.adjustmentMeta
          ? toDecimal128(negateDecimal(original.adjustmentMeta.taxEffectAmount))
          : toDecimal128('0'),
        disclosureText: '',
      },
      createdBy: args.actor._id,
      committedAt: new Date(),
      committedBy: args.actor._id,
      reversesEntryId: original._id,
    });

    await this.createLines(reversal, flippedLines, orgId, original.periodId);

    // Stamp the original so the UI can render its reversed state without a join.
    original.reversedAt = new Date();
    original.reversedBy = args.actor._id;
    original.status = 'reversed';
    await original.save();

    const rollup = await this.balanceRollup.rollupForEntries([reversal]);

    this.logger.logAction('ledger.adjustment.reversed', {
      orgId: orgId.toString(),
      originalEntryId: original._id.toString(),
      reversalEntryId: reversal._id.toString(),
      reason: args.reason,
      rolledUpKeys: rollup.affectedKeys.length,
      actor: args.actor._id.toString(),
    });

    return reversal;
  }

  // ─── Read ──────────────────────────────────────────────────────────────────

  async listAdjustments(args: {
    organizationId: Types.ObjectId | string;
    periodId?: Types.ObjectId | string;
    status?: 'draft' | 'committed' | 'reversed';
    standard?: string;
  }): Promise<JournalEntryDocument[]> {
    const query: Record<string, unknown> = {
      organizationId: this.asObjectId(args.organizationId),
      source: 'adjustment',
    };
    if (args.periodId) query.periodId = this.asObjectId(args.periodId);
    if (args.status) query.status = args.status;
    if (args.standard) query['adjustmentMeta.standard'] = args.standard;
    return this.entryModel.find(query).sort({ date: -1, createdAt: -1 });
  }

  async getAdjustment(
    organizationId: Types.ObjectId | string,
    entryId: string,
  ): Promise<{ entry: JournalEntryDocument; lines: JournalEntryLine[] }> {
    const orgId = this.asObjectId(organizationId);
    if (!isValidObjectId(entryId)) {
      throw new NotFoundException({
        error: 'ADJUSTMENT_NOT_FOUND',
        message: 'Adjustment entry not found',
      });
    }
    const entry = await this.entryModel.findOne({
      _id: new Types.ObjectId(entryId),
      organizationId: orgId,
      source: 'adjustment',
    });
    if (!entry) {
      throw new NotFoundException({
        error: 'ADJUSTMENT_NOT_FOUND',
        message: 'Adjustment entry not found',
      });
    }
    const lines = await this.lineModel.find({ entryId: entry._id }).lean();
    return { entry, lines };
  }

  // ─── Internal helpers ──────────────────────────────────────────────────────

  private async requireDraftAdjustment(
    orgId: Types.ObjectId,
    entryId: string,
  ): Promise<JournalEntryDocument> {
    if (!isValidObjectId(entryId)) {
      throw new NotFoundException({
        error: 'ADJUSTMENT_NOT_FOUND',
        message: 'Adjustment entry not found',
      });
    }
    const entry = await this.entryModel.findOne({
      _id: new Types.ObjectId(entryId),
      organizationId: orgId,
      source: 'adjustment',
    });
    if (!entry) {
      throw new NotFoundException({
        error: 'ADJUSTMENT_NOT_FOUND',
        message: 'Adjustment entry not found',
      });
    }
    if (entry.status !== 'draft') {
      throw new ForbiddenException({
        error: 'NOT_DRAFT',
        message: `Adjustment is already ${entry.status} and cannot be committed`,
      });
    }
    return entry;
  }

  private validateMeta(meta: AdjustmentMetaInput): void {
    if (!meta.standard || meta.standard.trim().length === 0) {
      throw new BadRequestException({
        error: 'MISSING_STANDARD',
        message: 'adjustmentMeta.standard is required (IAS 16 / IFRS 16 / IFRS 9 / IFRS 15 / IAS 12 / …)',
      });
    }
    if (!meta.reason || meta.reason.trim().length === 0) {
      throw new BadRequestException({
        error: 'MISSING_REASON',
        message: 'adjustmentMeta.reason is required — every adjustment must carry its narrative for the audit trail',
      });
    }
  }

  private async validateLines(
    orgId: Types.ObjectId,
    lines: AdjustmentLineInput[],
  ): Promise<void> {
    if (lines.length < 2) {
      throw new BadRequestException({
        error: 'TOO_FEW_LINES',
        message: 'Adjustment needs at least two lines (one Dt, one Cr)',
      });
    }

    const codes = Array.from(new Set(lines.map((l) => l.accountCode)));
    const chart = await this.chartModel
      .find({ organizationId: orgId, code: { $in: codes }, isActive: true })
      .select('code')
      .lean();
    const knownCodes = new Set(chart.map((c) => c.code));
    const unknown = codes.filter((c) => !knownCodes.has(c));
    if (unknown.length > 0) {
      throw new BadRequestException({
        error: 'UNKNOWN_ACCOUNTS',
        message: `Accounts not found in the chart: ${unknown.join(', ')}`,
      });
    }

    const counterpartyIds = Array.from(
      new Set(
        lines
          .map((l) => l.counterpartyId)
          .filter((id): id is string => typeof id === 'string' && id.length > 0),
      ),
    );
    if (counterpartyIds.length > 0) {
      for (const cid of counterpartyIds) {
        if (!isValidObjectId(cid)) {
          throw new BadRequestException({
            error: 'INVALID_COUNTERPARTY_ID',
            message: `counterpartyId is not a valid id: ${cid}`,
          });
        }
      }
      const objIds = counterpartyIds.map((id) => new Types.ObjectId(id));
      const found = await this.counterpartyModel
        .find({ _id: { $in: objIds }, organizationId: orgId })
        .select('_id')
        .lean();
      const foundSet = new Set(found.map((c) => c._id.toString()));
      const missing = counterpartyIds.filter((id) => !foundSet.has(id));
      if (missing.length > 0) {
        throw new BadRequestException({
          error: 'UNKNOWN_COUNTERPARTIES',
          message: `Counterparties not found: ${missing.join(', ')}`,
        });
      }
    }

    for (const line of lines) {
      if (compareDecimals(line.amount, '0') < 0) {
        throw new BadRequestException({
          error: 'NEGATIVE_AMOUNT',
          message: `Line amounts must be non-negative — got ${line.amount} on ${line.accountCode}. Use direction to express sign.`,
        });
      }
      if (line.direction !== 'debit' && line.direction !== 'credit') {
        throw new BadRequestException({
          error: 'INVALID_DIRECTION',
          message: `direction must be 'debit' or 'credit', got "${line.direction as string}"`,
        });
      }
    }
  }

  /** Returns the total amount (sum of debits) as a decimal string. */
  private assertBalanced(lines: AdjustmentLineInput[]): string {
    const debitSum = addDecimals(
      ...lines.filter((l) => l.direction === 'debit').map((l) => l.amount),
    );
    const creditSum = addDecimals(
      ...lines.filter((l) => l.direction === 'credit').map((l) => l.amount),
    );
    if (compareDecimals(debitSum, creditSum) !== 0) {
      throw new BadRequestException({
        error: 'UNBALANCED',
        message: `Adjustment is not balanced — sum of debits (${debitSum}) ≠ sum of credits (${creditSum})`,
      });
    }
    if (!isPositive(debitSum)) {
      throw new BadRequestException({
        error: 'ZERO_TOTAL',
        message: 'Adjustment total must be positive',
      });
    }
    return debitSum;
  }

  private async createLines(
    entry: JournalEntryDocument,
    lines: AdjustmentLineInput[],
    orgId: Types.ObjectId,
    periodId: Types.ObjectId,
  ): Promise<void> {
    const docs = lines.map((line) => ({
      entryId: entry._id,
      organizationId: orgId,
      periodId,
      layer: BALANCE_LAYER.ADJUSTMENT,
      date: entry.date,
      accountCode: line.accountCode,
      direction: line.direction,
      amount: toDecimal128(line.amount),
      counterpartyId: line.counterpartyId
        ? new Types.ObjectId(line.counterpartyId)
        : null,
      subconto1Value:
        line.subconto1Value !== undefined
          ? line.subconto1Value
          : line.counterpartyId ?? null,
      subconto2Value: line.subconto2Value ?? null,
      subconto3Value: line.subconto3Value ?? null,
      description: (line.description ?? '').substring(0, 990),
    }));
    await this.lineModel.insertMany(docs);
  }

  private asObjectId(v: Types.ObjectId | string): Types.ObjectId {
    return typeof v === 'string' ? new Types.ObjectId(v) : v;
  }
}
