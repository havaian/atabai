import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsMongoId,
  IsOptional,
  IsString,
  Length,
  Matches,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

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

  /**
   * Settlement documents this payment gashes (methodology §6.3 / §7.2). One
   * entry settles the whole payment against a single document; several entries
   * split the payment across documents (multi-doc split — amounts entered by
   * the operator, their sum must equal the payment). Attaching document(s) is
   * what clears the "document required" block on an external row.
   */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DraftDocumentDto)
  documents?: DraftDocumentDto[];
}

/** One document allocation on a bank draft (methodology §6.3 / §7.2). */
export class DraftDocumentDto {
  @IsIn(['contract', 'invoice'])
  documentType!: 'contract' | 'invoice';

  @IsMongoId({ message: 'documentId must be a valid id' })
  documentId!: string;

  /**
   * Amount of the payment allocated to this document. Optional for a single
   * document (defaults to the whole payment); required, and must sum to the
   * payment, when more than one document is supplied.
   */
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d+)?$/, { message: 'amount must be a decimal number string' })
  amount?: string;
}

/**
 * Payload for POST .../bank-statements/:uploadId/commit (methodology
 * дополнение §1.3). `entryIds` is the set of draft rows the operator ticked
 * to post. Optional: when omitted, the service considers the whole batch
 * (legacy behaviour). Rows still carrying the '000' placeholder are skipped
 * server-side regardless, so this list can never force an unresolved post.
 */
export class CommitBankDraftsDto {
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true, message: 'each entryId must be a valid id' })
  entryIds?: string[];
}
