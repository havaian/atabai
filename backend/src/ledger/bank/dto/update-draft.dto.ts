import {
  IsMongoId,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

/**
 * Payload for fixing a RED bank draft (bank ТЗ §7 — operator review).
 *
 * The placeholder line on a RED draft carries accountCode '000' and the
 * operator picks the real account here. Optionally re-attributes the
 * draft to a different counterparty (e.g. they meant a different supplier)
 * and/or rewrites the description.
 *
 * All fields are optional — but the service rejects an entirely empty
 * patch, since the only reason to call this endpoint is to materially
 * change the draft.
 */
export class UpdateBankDraftDto {
  /** New record-side account code. Must exist on the org's ChartOfAccount. */
  @IsOptional()
  @IsString()
  @Matches(/^\d+(?:\.\d+)*$/, {
    message: 'accountCode must look like an NSBU account code (digits with optional dot-suffix)',
  })
  accountCode?: string;

  /** New counterparty. Must exist in the org's registry. */
  @IsOptional()
  @IsMongoId({ message: 'counterpartyId must be a valid id' })
  counterpartyId?: string;

  @IsOptional()
  @IsString()
  @Length(0, 1990)
  description?: string;
}
