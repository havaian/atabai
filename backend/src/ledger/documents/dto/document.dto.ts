import {
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export const DOCUMENT_KINDS = ['contract', 'invoice'] as const;
export type DocumentKindDto = (typeof DOCUMENT_KINDS)[number];

/** Create a contract/invoice for a counterparty (methodology §7). */
export class CreateDocumentDto {
  @IsIn(DOCUMENT_KINDS)
  kind!: DocumentKindDto;

  @IsString()
  @MaxLength(200)
  number!: string;

  // ISO date string; optional (a number may arrive without a parseable date).
  @IsOptional()
  @IsISO8601()
  date?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  // Invoice only — Decimal128 string. Validated as a plain decimal number
  // shape; money is never a JS float on the ledger.
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d+)?$/, { message: 'amount must be a decimal number string' })
  amount?: string;
}

/** Ask for document suggestions for a payment purpose against a counterparty. */
export class SuggestDocumentsDto {
  @IsIn(DOCUMENT_KINDS)
  kind!: DocumentKindDto;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  purpose?: string;
}
