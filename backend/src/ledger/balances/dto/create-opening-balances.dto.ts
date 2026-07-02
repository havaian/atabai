import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsIn,
  IsMongoId,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

import { ALL_OPENING_BALANCE_ACCOUNTS } from '../../constants/opening-balance';

/**
 * One opening balance = one open document under a counterparty (methodology
 * §6.2 / Filipp 02.07.26: entered PER DOCUMENT). The `account` picks which of
 * the four settlement positions the balance sits on (4010/4310/6010/6310); the
 * posting side is derived from the account, so no direction is sent. The
 * document is referenced by `documentId` (an existing contract/invoice) OR
 * created from `documentNumber` (+ optional `documentDate`) — the latter also
 * covers the rare dummy-document fallback (just a placeholder number). A
 * document is always required: an opening debt with no document could not be
 * settled per §6.3.
 */
export class OpeningBalanceItemDto {
  @IsMongoId({ message: 'counterpartyId must be a valid id' })
  counterpartyId!: string;

  @IsIn(ALL_OPENING_BALANCE_ACCOUNTS as readonly string[], {
    message: 'account must be one of 4010 (receivable), 4310 (advance issued), 6010 (payable), 6310 (advance received)',
  })
  account!: string;

  // Positive decimal string (no sign). Non-zero-and-positive is enforced in the
  // service against Decimal128 — the regex only rejects malformed / negative
  // input early with a friendly message.
  @IsString()
  @Matches(/^\d+(?:\.\d+)?$/, {
    message: 'amount must be a positive decimal string (digits, optional single dot)',
  })
  amount!: string;

  @IsIn(['contract', 'invoice'], {
    message: "documentType must be 'contract' or 'invoice'",
  })
  documentType!: 'contract' | 'invoice';

  @IsOptional()
  @IsMongoId({ message: 'documentId must be a valid id when provided' })
  documentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  documentNumber?: string;

  @IsOptional()
  @IsDateString({}, { message: 'documentDate must be an ISO date string' })
  documentDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}

/**
 * Payload for POST .../opening-balances — a batch of per-document opening
 * balances entered against the period in the path. `asOfDate` defaults to the
 * period's start date in the service. The batch posts as ONE balanced journal
 * entry (source `opening_balance`), each item a counterparty leg plus a single
 * balancing leg on the auxiliary account 0000.
 */
export class CreateOpeningBalancesDto {
  @IsOptional()
  @IsDateString({}, { message: 'asOfDate must be an ISO date string' })
  asOfDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => OpeningBalanceItemDto)
  items!: OpeningBalanceItemDto[];
}
