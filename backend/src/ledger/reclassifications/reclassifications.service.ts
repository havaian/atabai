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
import { addDecimals, compareDecimals, isPositive, toDecimal128 } from '../decimal-arithmetic';
import { ChartOfAccount, type ChartOfAccountModel } from '../schemas/chart-of-account.schema';
import { Counterparty, type CounterpartyModel } from '../schemas/counterparty.schema';
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
import { BalanceRollupService, type RollupKey } from '../services/balance-rollup.service';
import { type DerivationKey, IfrsDerivationService } from '../services/ifrs-derivation.service';
import { PeriodsService } from '../services/periods.service';

export interface ReclassificationLineInput {
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

export interface CreateReclassificationArgs {
  organizationId: Types.ObjectId | string;
  periodId: Types.ObjectId | string;
  date: Date;
  /** Required narrative — stored on JournalEntry.description. */
  reason: string;
  lines: ReclassificationLineInput[];
  /** Optional free-text source pointer for the audit trail. */
  sourceRef?: string | null;
  actor: UserDocument;
}

export interface ReverseReclassificationArgs {
  organizationId: Types.ObjectId | string;
  entryId: string;
  reason: string;
  actor: UserDocument;
}

/**
 * Reclassification engine — methodology step 3 (second half) / architecture
 * doc §7.2.
 *
 * The `reclassification` layer regroups the trial balance for IFRS
 * presentation (e.g. moving the current portion of a long-term loan into
 * short-term liabilities) WITHOUT changing the financial result. It sits
 * between `nsbu_base` and `adjustment` in the transformation matrix and is
 * folded into the derived `ifrs` layer by IfrsDerivationService.
 *
 * Relationship to AdjustmentsService — deliberately parallel, not shared:
 *   - Same proven draft → commit → reverse lifecycle and the same
 *     balanced-double-entry + account/counterparty validation.
 *   - Different layer (`reclassification`) and source (`reclassification`).
 *   - No `adjustmentMeta`: a reclass carries no IFRS standard, no deferred-tax
 *     effect, and no disclosure text — those are adjustment-only. Its entire
 *     narrative is the `reason`, stored on JournalEntry.description.
 *   The working AdjustmentsService is left untouched; the small amount of
 *   duplicated validation here is intentionally simpler than prematurely
 *   abstracting a shared base out of a tested file.
 *
 * On the "financial result unchanged" property:
 *   What is ENFORCED here is the double-entry invariant — every entry is
 *   balanced (Σ debits = Σ credits). A balanced entry preserves the accounting
 *   equation, which is what keeps a reclass presentation-neutral at the
 *   totals level. What is NOT machine-verified is that the entry touches no
 *   P&L / equity account in a way that nets the result up or down — that would
 *   require a per-account P&L-vs-balance-sheet classification the chart does
 *   not yet carry (it is part of the account-level statement map still to be
 *   built for statement assembly). Until that exists, result-neutrality is the
 *   IFRS specialist's responsibility — consistent with how adjustment
 *   correctness already depends on the specialist-in-the-loop. A future guard
 *   ("a reclass may not touch a result account") can be added once that
 *   classification lands, without changing this service's shape.
 *
 * Reversal: append-only, identical to adjustments — a sign-flipped counter
 * entry with `reversesEntryId` pointing back; the original stays in the
 * ledger and their net effect on AccountBalance after rollup is zero.
 */
@Injectable()
export class ReclassificationService {
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
    private readonly ifrsDerivation: IfrsDerivationService,
    private readonly logger: AppLoggerService,
  ) {}

  // ─── Create ────────────────────────────────────────────────────────────────

  async createDraft(args: CreateReclassificationArgs): Promise<JournalEntryDocument> {
    const orgId = this.asObjectId(args.organizationId);
    const periodId = this.asObjectId(args.periodId);

    await this.periods.assertWritable(orgId, periodId);
    this.validateReason(args.reason);
    await this.validateLines(orgId, args.lines);

    const total = this.assertBalanced(args.lines);

    const entry = await this.entryModel.create({
      organizationId: orgId,
      periodId,
      date: args.date,
      description: args.reason.trim().substring(0, 1990),
      source: 'reclassification',
      sourceRef: args.sourceRef ?? null,
      layer: BALANCE_LAYER.RECLASSIFICATION,
      status: 'draft',
      totalAmount: toDecimal128(total),
      // No adjustmentMeta — reclassification carries no standard/tax/disclosure.
      createdBy: args.actor._id,
    });

    await this.createLines(entry, args.lines, orgId, periodId);

    this.logger.logAction('ledger.reclassification.drafted', {
      orgId: orgId.toString(),
      periodId: periodId.toString(),
      entryId: entry._id.toString(),
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
    const entry = await this.requireDraftReclassification(orgId, args.entryId);

    await this.periods.assertWritable(orgId, entry.periodId);

    entry.status = 'committed';
    entry.committedAt = new Date();
    entry.committedBy = args.actor._id;
    await entry.save();

    const rollup = await this.balanceRollup.rollupForEntries([entry]);

    // Committing a reclassification changes the `reclassification` layer for
    // these keys, so the derived `ifrs` layer (= nsbu_base + reclassification +
    // adjustment) is now stale for them — re-derive off the just-updated
    // balances. Same rollup-then-derive pattern as the adjustment commit path.
    const derivation = await this.ifrsDerivation.deriveKeys(
      orgId,
      entry.periodId,
      this.toDerivationKeys(rollup.affectedKeys),
    );

    this.logger.logAction('ledger.reclassification.committed', {
      orgId: orgId.toString(),
      entryId: entry._id.toString(),
      rolledUpKeys: rollup.affectedKeys.length,
      derivedKeys: derivation.derivedKeys.length,
      actor: args.actor._id.toString(),
    });

    return entry;
  }

  // ─── Reverse ───────────────────────────────────────────────────────────────

  /**
   * Create a sign-flipped counter-entry. The original stays in the ledger
   * (append-only); their sum on AccountBalance after rollup is zero.
   */
  async reverseEntry(args: ReverseReclassificationArgs): Promise<JournalEntryDocument> {
    const orgId = this.asObjectId(args.organizationId);

    if (!isValidObjectId(args.entryId)) {
      throw new NotFoundException({
        error: 'RECLASSIFICATION_NOT_FOUND',
        message: 'Reclassification entry not found',
      });
    }
    const original = await this.entryModel.findOne({
      _id: new Types.ObjectId(args.entryId),
      organizationId: orgId,
      source: 'reclassification',
    });
    if (!original) {
      throw new NotFoundException({
        error: 'RECLASSIFICATION_NOT_FOUND',
        message: 'Reclassification entry not found',
      });
    }
    if (original.status !== 'committed') {
      throw new BadRequestException({
        error: 'NOT_COMMITTED',
        message: 'Only committed reclassifications can be reversed',
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

    // Build flipped lines. Direction swap; amount unchanged. Subconto +
    // counterparty preserved.
    const flippedLines: ReclassificationLineInput[] = originalLines.map((l) => ({
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
      description: `Reversal of ${original._id.toString()} — ${args.reason.trim()}`.substring(
        0,
        1990,
      ),
      source: 'reclassification',
      sourceRef: original.sourceRef
        ? `reversal:${original.sourceRef}`
        : `reversal:${original._id.toString()}`,
      layer: BALANCE_LAYER.RECLASSIFICATION,
      status: 'committed',
      totalAmount: toDecimal128(total),
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

    // A reversal moves the `reclassification` layer back for these keys, so the
    // derived `ifrs` layer is stale for them too — re-derive, same as commit.
    const derivation = await this.ifrsDerivation.deriveKeys(
      orgId,
      original.periodId,
      this.toDerivationKeys(rollup.affectedKeys),
    );

    this.logger.logAction('ledger.reclassification.reversed', {
      orgId: orgId.toString(),
      originalEntryId: original._id.toString(),
      reversalEntryId: reversal._id.toString(),
      reason: args.reason,
      rolledUpKeys: rollup.affectedKeys.length,
      derivedKeys: derivation.derivedKeys.length,
      actor: args.actor._id.toString(),
    });

    return reversal;
  }

  // ─── Read ──────────────────────────────────────────────────────────────────

  async listReclassifications(args: {
    organizationId: Types.ObjectId | string;
    periodId?: Types.ObjectId | string;
    status?: 'draft' | 'committed' | 'reversed';
  }): Promise<JournalEntryDocument[]> {
    const query: Record<string, unknown> = {
      organizationId: this.asObjectId(args.organizationId),
      source: 'reclassification',
    };
    if (args.periodId) query.periodId = this.asObjectId(args.periodId);
    if (args.status) query.status = args.status;
    return this.entryModel.find(query).sort({ date: -1, createdAt: -1 });
  }

  async getReclassification(
    organizationId: Types.ObjectId | string,
    entryId: string,
  ): Promise<{ entry: JournalEntryDocument; lines: JournalEntryLine[] }> {
    const orgId = this.asObjectId(organizationId);
    if (!isValidObjectId(entryId)) {
      throw new NotFoundException({
        error: 'RECLASSIFICATION_NOT_FOUND',
        message: 'Reclassification entry not found',
      });
    }
    const entry = await this.entryModel.findOne({
      _id: new Types.ObjectId(entryId),
      organizationId: orgId,
      source: 'reclassification',
    });
    if (!entry) {
      throw new NotFoundException({
        error: 'RECLASSIFICATION_NOT_FOUND',
        message: 'Reclassification entry not found',
      });
    }
    const lines = await this.lineModel.find({ entryId: entry._id }).lean();
    return { entry, lines };
  }

  // ─── Internal helpers ──────────────────────────────────────────────────────

  private async requireDraftReclassification(
    orgId: Types.ObjectId,
    entryId: string,
  ): Promise<JournalEntryDocument> {
    if (!isValidObjectId(entryId)) {
      throw new NotFoundException({
        error: 'RECLASSIFICATION_NOT_FOUND',
        message: 'Reclassification entry not found',
      });
    }
    const entry = await this.entryModel.findOne({
      _id: new Types.ObjectId(entryId),
      organizationId: orgId,
      source: 'reclassification',
    });
    if (!entry) {
      throw new NotFoundException({
        error: 'RECLASSIFICATION_NOT_FOUND',
        message: 'Reclassification entry not found',
      });
    }
    if (entry.status !== 'draft') {
      throw new ForbiddenException({
        error: 'NOT_DRAFT',
        message: `Reclassification is already ${entry.status} and cannot be committed`,
      });
    }
    return entry;
  }

  private validateReason(reason: string): void {
    if (!reason || reason.trim().length === 0) {
      throw new BadRequestException({
        error: 'MISSING_REASON',
        message:
          'reason is required — every reclassification must carry its narrative for the audit trail',
      });
    }
  }

  private async validateLines(
    orgId: Types.ObjectId,
    lines: ReclassificationLineInput[],
  ): Promise<void> {
    if (lines.length < 2) {
      throw new BadRequestException({
        error: 'TOO_FEW_LINES',
        message: 'Reclassification needs at least two lines (one Dt, one Cr)',
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

  /**
   * Returns the total amount (sum of debits) as a decimal string. Enforces the
   * double-entry invariant — Σ debits = Σ credits — which is what keeps the
   * reclassification presentation-neutral at the totals level (see the class
   * docblock on the result-neutrality boundary).
   */
  private assertBalanced(lines: ReclassificationLineInput[]): string {
    const debitSum = addDecimals(
      ...lines.filter((l) => l.direction === 'debit').map((l) => l.amount),
    );
    const creditSum = addDecimals(
      ...lines.filter((l) => l.direction === 'credit').map((l) => l.amount),
    );
    if (compareDecimals(debitSum, creditSum) !== 0) {
      throw new BadRequestException({
        error: 'UNBALANCED',
        message: `Reclassification is not balanced — sum of debits (${debitSum}) ≠ sum of credits (${creditSum})`,
      });
    }
    if (!isPositive(debitSum)) {
      throw new BadRequestException({
        error: 'ZERO_TOTAL',
        message: 'Reclassification total must be positive',
      });
    }
    return debitSum;
  }

  private async createLines(
    entry: JournalEntryDocument,
    lines: ReclassificationLineInput[],
    orgId: Types.ObjectId,
    periodId: Types.ObjectId,
  ): Promise<void> {
    const docs = lines.map((line) => ({
      entryId: entry._id,
      organizationId: orgId,
      periodId,
      layer: BALANCE_LAYER.RECLASSIFICATION,
      date: entry.date,
      accountCode: line.accountCode,
      direction: line.direction,
      amount: toDecimal128(line.amount),
      counterpartyId: line.counterpartyId ? new Types.ObjectId(line.counterpartyId) : null,
      subconto1Value:
        line.subconto1Value !== undefined ? line.subconto1Value : (line.counterpartyId ?? null),
      subconto2Value: line.subconto2Value ?? null,
      subconto3Value: line.subconto3Value ?? null,
      description: (line.description ?? '').substring(0, 990),
    }));
    await this.lineModel.insertMany(docs);
  }

  /**
   * Map the rollup's affected keys to IFRS derivation keys by dropping the
   * `layer` field — derivation sums across layers per (account, subconto-combo).
   */
  private toDerivationKeys(keys: RollupKey[]): DerivationKey[] {
    return keys.map((k) => ({
      accountCode: k.accountCode,
      subconto1Value: k.subconto1Value,
      subconto2Value: k.subconto2Value,
      subconto3Value: k.subconto3Value,
      counterpartyId: k.counterpartyId,
    }));
  }

  private asObjectId(v: Types.ObjectId | string): Types.ObjectId {
    return typeof v === 'string' ? new Types.ObjectId(v) : v;
  }
}
