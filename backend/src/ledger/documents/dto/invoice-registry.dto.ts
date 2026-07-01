import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsMongoId,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';

/**
 * One operator-line account assignment: which draft leg (`lineId`) gets which
 * NSBU account (`accountCode`). The RED invoice draft carries the placeholder
 * account '000' on each line item; the operator picks the real
 * expense/inventory/asset (incoming) or revenue (outgoing) account here
 * (methodology §7.2 — same shape as the bank treasury red-row fix).
 */
export class InvoiceDraftLineAccountDto {
  @IsMongoId({ message: 'lineId must be a valid id' })
  lineId!: string;

  @IsString()
  @Matches(/^\d+(?:\.\d+)*$/, {
    message:
      'accountCode must look like an NSBU account code (digits with optional dot-suffix)',
  })
  accountCode!: string;
}

/**
 * Payload for PATCH .../invoice-registry/:uploadId/drafts/:entryId — set the
 * per-line accounts on a RED invoice draft. At least one assignment is
 * required; each is validated against the org's chart in the service before it
 * is stamped on the leg.
 */
export class UpdateInvoiceDraftDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => InvoiceDraftLineAccountDto)
  lineAccounts!: InvoiceDraftLineAccountDto[];
}
