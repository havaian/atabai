import { Type } from 'class-transformer';
import {
  IsArray,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

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
}

/**
 * Payload for the admin "edit organization requisites" screen.
 *
 * Deliberately omits `transitionDate`: once the first-time-adoption date is
 * set it anchors every downstream balance, so it is not editable here (see
 * OrganizationProfilesService docblock). Everything else an admin sees on the
 * profile is editable. All fields optional — a PATCH only touches what it
 * carries; `bankAccounts`, when present, REPLACES the whole list (the edit
 * form submits the full set).
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
}
