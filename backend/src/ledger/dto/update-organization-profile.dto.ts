import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import {
  ALL_INVENTORY_VALUATIONS,
  ALL_LEAVE_RESERVES,
  ALL_PAYROLL_DETAILS,
  ALL_SETTLEMENT_DEPTHS,
  ALL_TAX_REGIMES,
  type InventoryValuation,
  type LeaveReserve,
  type PayrollDetail,
  type SettlementDepth,
  type TaxRegime,
} from '../constants/accounting-policy';

/**
 * One settlement account owned by the organization (mirrors the
 * OrgBankAccount sub-schema on OrganizationProfile). The bank engine matches
 * an uploaded statement to the org by comparing the statement's account
 * against this list (bank ТЗ §2), so the admin needs to be able to maintain
 * it after onboarding — which is what the PATCH endpoint exists for.
 */
export class OrgBankAccountDto {
  @IsString()
  @Length(1, 34, {
    message: 'accountNumber must be 1-34 characters',
  })
  accountNumber!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  bankCode?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string | null;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z]{3}$/, {
    message: 'currency must be a 3-letter code (e.g. UZS)',
  })
  currency?: string;

  // NSBU ledger account this settlement account posts to (e.g. 5110, 5210,
  // 5730, 5530). Optional; the bank engine needs it to post internal-contour
  // transfers but a profile may be saved before it's filled in.
  @IsOptional()
  @IsString()
  @MaxLength(20)
  ledgerAccount?: string | null;

  // Sub-account as its own field (methodology §3.5) — not concatenated into
  // accountNumber. Optional; null/absent means the account has no sub-account.
  @IsOptional()
  @IsString()
  @MaxLength(20)
  subAccount?: string | null;

  // Closed accounts are flagged inactive rather than removed (methodology
  // §3.5). Optional on the wire; defaults to active in the service when absent.
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/**
 * Accounting-policy block edits (methodology §9). All fields optional — a
 * PATCH merges only the blocks it carries onto the stored policy, so changing
 * one setting doesn't require resubmitting all six. Enum values are validated
 * against the same constants the schema uses.
 */
export class AccountingPolicyDto {
  @IsOptional()
  @IsIn(ALL_TAX_REGIMES)
  taxRegime?: TaxRegime;

  @IsOptional()
  @IsBoolean()
  vatPayer?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  vatRate?: number;

  @IsOptional()
  @IsIn(ALL_INVENTORY_VALUATIONS)
  inventoryValuation?: InventoryValuation;

  @IsOptional()
  @IsBoolean()
  allowNegativeStock?: boolean;

  @IsOptional()
  @IsIn(ALL_SETTLEMENT_DEPTHS)
  settlementDepth?: SettlementDepth;

  @IsOptional()
  @IsIn(ALL_PAYROLL_DETAILS)
  payrollDetail?: PayrollDetail;

  @IsOptional()
  @IsIn(ALL_LEAVE_RESERVES)
  leaveReserve?: LeaveReserve;
}

/**
 * Payload for the admin "edit organization requisites" screen.
 *
 * Deliberately omits `transitionDate`: once the first-time-adoption date is
 * set it anchors every downstream balance, so it is not editable here (see
 * OrganizationProfilesService docblock). Everything else an admin sees on the
 * profile is editable. All fields optional — a PATCH only touches what it
 * carries; `bankAccounts`, when present, REPLACES the whole list (the edit
 * form submits the full set). `accountingPolicy`, when present, MERGES the
 * provided blocks onto the stored policy.
 */
export class UpdateOrganizationProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  legalName?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{9}$/, {
    message: 'inn must be a 9-digit Uzbek ИНН',
  })
  inn?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z]{3}$/, {
    message: 'baseCurrency must be a 3-letter code (e.g. UZS)',
  })
  baseCurrency?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrgBankAccountDto)
  bankAccounts?: OrgBankAccountDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => AccountingPolicyDto)
  accountingPolicy?: AccountingPolicyDto;
}
