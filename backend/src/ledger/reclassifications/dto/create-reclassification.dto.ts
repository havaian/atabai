import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDate,
  IsIn,
  IsMongoId,
  IsOptional,
  IsString,
  Length,
  Matches,
  ValidateNested,
} from 'class-validator';

import { LINE_DIRECTIONS, type LineDirection } from '../../schemas/journal-entry-line.schema';

const DECIMAL_RE = /^-?\d+(?:\.\d+)?$/;
const ACCOUNT_CODE_RE = /^\d+(?:\.\d+)*$/;

/**
 * One leg of a reclassification posting. Identical shape to the adjustment
 * line — the difference between the two layers is semantic (a reclass moves
 * amounts between accounts without changing the financial result), not
 * structural, so the line validation is the same.
 */
class ReclassificationLineDto {
  @IsString()
  @Matches(ACCOUNT_CODE_RE, {
    message: 'accountCode must look like an NSBU account code',
  })
  accountCode!: string;

  @IsIn(LINE_DIRECTIONS, { message: "direction must be 'debit' or 'credit'" })
  direction!: LineDirection;

  @IsString()
  @Matches(DECIMAL_RE, { message: 'amount must be a decimal string' })
  amount!: string;

  @IsOptional()
  @IsMongoId({ message: 'counterpartyId must be a valid id' })
  counterpartyId?: string | null;

  @IsOptional()
  @IsString()
  @Length(0, 200)
  subconto1Value?: string | null;

  @IsOptional()
  @IsString()
  @Length(0, 200)
  subconto2Value?: string | null;

  @IsOptional()
  @IsString()
  @Length(0, 200)
  subconto3Value?: string | null;

  @IsOptional()
  @IsString()
  @Length(0, 990)
  description?: string;
}

export class CreateReclassificationDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' || value instanceof Date ? new Date(value) : value,
  )
  @IsDate({ message: 'date must be a valid date' })
  date!: Date;

  /**
   * Why the regrouping is being made (e.g. "reclassify current portion of
   * long-term loan to short-term liabilities"). Required — a reclass carries
   * no IFRS standard / tax / disclosure (those are adjustment-only), so the
   * reason is the entry's entire narrative for the audit trail. Stored on the
   * JournalEntry.description.
   */
  @IsString()
  @Length(1, 1990, { message: 'reason is required' })
  reason!: string;

  @IsArray()
  @ArrayMinSize(2, { message: 'Reclassification needs at least two lines' })
  @ValidateNested({ each: true })
  @Type(() => ReclassificationLineDto)
  lines!: ReclassificationLineDto[];

  @IsOptional()
  @IsString()
  @Length(0, 500)
  sourceRef?: string;
}
