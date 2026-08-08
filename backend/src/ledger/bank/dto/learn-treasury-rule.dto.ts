import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';

import {
  TREASURY_RULE_KINDS,
  type TreasuryRuleKind,
} from '../../schemas/treasury-rule.schema';

/**
 * Payload for the bank-engine learning loop (bank ТЗ §7 - "Добавить в правила").
 *
 * The operator fixed a RED treasury draft manually; this endpoint
 * teaches the engine to match the same pattern automatically next time.
 *
 * `pattern` is the substring/needle from Назначение платежа that uniquely
 * identifies this tax/budget line (typically the 20+ digit treasury
 * account number). `recordAccountCode` is the account the operator just
 * picked when fixing the draft.
 */
export class LearnTreasuryRuleDto {
  @IsString()
  @Length(1, 200)
  pattern!: string;

  @IsString()
  @Matches(/^\d+(?:\.\d+)*$/, {
    message: 'recordAccountCode must look like an NSBU account code',
  })
  recordAccountCode!: string;

  @IsOptional()
  @IsIn(TREASURY_RULE_KINDS, { message: "kind must be 'exact' or 'keyword'" })
  kind?: TreasuryRuleKind;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  priority?: number;
}
