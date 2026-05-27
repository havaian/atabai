import { ConflictException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Types } from 'mongoose';

import { AppLoggerService } from '../../common/logger/app-logger.service';
import type { UserDocument } from '../../users/schemas/user.schema';
import {
  TreasuryRule,
  type TreasuryRuleDocument,
  type TreasuryRuleKind,
  type TreasuryRuleModel,
} from '../schemas/treasury-rule.schema';

export interface ResolveTreasuryArgs {
  organizationId: Types.ObjectId;
  /** Free-text "Назначение платежа" from the bank row. */
  purpose: string;
}

export interface ResolveTreasuryResult {
  rule: TreasuryRuleDocument;
  recordAccountCode: string;
  /** What part of the purpose triggered the match (for the audit trail / UI). */
  matchedOn: string;
}

/**
 * Treasury record-account resolver — bank ТЗ §4.
 *
 * Search order (deterministic):
 *   1. EXACT rules first, ordered by priority desc. For each rule, find an
 *      occurrence of `pattern` as a substring of the purpose. The ТЗ
 *      example pattern is a 20+ digit account number embedded in the free
 *      text; substring match suffices and is faster than regex.
 *   2. KEYWORD rules second, ordered by priority desc. Treats `pattern`
 *      as a substring match too (lowercased on both sides). Reserved for
 *      ambiguous "wording-based" rules the operator adds for edge cases.
 *
 * First match wins. Returns `null` when no rule fires — the caller paints
 * the row RED in the preview UI and the operator picks the record account
 * manually (and can click "Добавить в правила" to teach the next pass).
 */
@Injectable()
export class TreasuryResolverService {
  constructor(
    @InjectModel(TreasuryRule.name)
    private readonly ruleModel: TreasuryRuleModel,
    private readonly logger: AppLoggerService,
  ) {}

  async resolve(args: ResolveTreasuryArgs): Promise<ResolveTreasuryResult | null> {
    const { organizationId, purpose } = args;
    if (!purpose) return null;

    const rules = await this.ruleModel
      .find({ organizationId, isActive: true })
      .sort({ kind: 1, priority: -1 });

    const purposeLower = purpose.toLowerCase();
    for (const rule of rules) {
      const haystack = rule.kind === 'keyword' ? purposeLower : purpose;
      const needle = rule.kind === 'keyword' ? rule.pattern.toLowerCase() : rule.pattern;
      const idx = haystack.indexOf(needle);
      if (idx !== -1) {
        return {
          rule,
          recordAccountCode: rule.recordAccountCode,
          matchedOn: purpose.substring(idx, idx + needle.length),
        };
      }
    }
    return null;
  }

  /**
   * Persist a new rule — the "Добавить в правила" learning loop from bank ТЗ §7.
   *
   * Set `learnedFromBankReview: true` when the call originated from the
   * bank-preview "fix RED row" flow, false for operator-curated rules added
   * through a dedicated admin UI.
   *
   * Conflicts: the (org, kind, pattern) unique index rejects duplicates.
   * Surface this as a clean 409 so the UI can fall through to "this rule
   * already exists — edit its priority or record account instead."
   */
  async createRule(args: {
    organizationId: Types.ObjectId | string;
    pattern: string;
    recordAccountCode: string;
    kind?: TreasuryRuleKind;
    description?: string;
    priority?: number;
    actor: UserDocument;
    learnedFromBankReview: boolean;
  }): Promise<TreasuryRuleDocument> {
    const orgId =
      typeof args.organizationId === 'string'
        ? new Types.ObjectId(args.organizationId)
        : args.organizationId;

    try {
      const rule = await this.ruleModel.create({
        organizationId: orgId,
        kind: args.kind ?? 'exact',
        pattern: args.pattern.trim(),
        recordAccountCode: args.recordAccountCode.trim(),
        description: args.description?.trim() ?? '',
        priority: args.priority ?? 100,
        isActive: true,
        createdBy: args.actor._id,
        learnedFromBankReview: args.learnedFromBankReview,
      });

      this.logger.logAction('ledger.treasury.rule_created', {
        orgId: orgId.toString(),
        ruleId: rule._id.toString(),
        kind: rule.kind,
        recordAccountCode: rule.recordAccountCode,
        learnedFromBankReview: args.learnedFromBankReview,
        actor: args.actor._id.toString(),
      });

      return rule;
    } catch (err) {
      const e = err as { code?: number };
      if (e.code === 11000) {
        throw new ConflictException({
          error: 'RULE_DUPLICATE',
          message:
            'A rule with this (kind, pattern) already exists for the organization',
        });
      }
      throw err;
    }
  }
}
