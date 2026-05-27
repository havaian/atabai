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

import {
  LINE_DIRECTIONS,
  type LineDirection,
} from '../../schemas/journal-entry-line.schema';

const DECIMAL_RE = /^-?\d+(?:\.\d+)?$/;
const ACCOUNT_CODE_RE = /^\d+(?:\.\d+)*$/;

class AdjustmentLineDto {
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

class AdjustmentMetaDto {
  @IsString()
  @Length(1, 100)
  standard!: string;

  @IsString()
  @Length(1, 2000)
  reason!: string;

  @IsOptional()
  @IsString()
  @Matches(DECIMAL_RE, { message: 'taxEffectAmount must be a decimal string' })
  taxEffectAmount?: string;

  @IsOptional()
  @IsString()
  @Length(0, 4000)
  disclosureText?: string;
}

export class CreateAdjustmentDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' || value instanceof Date ? new Date(value) : value,
  )
  @IsDate({ message: 'date must be a valid date' })
  date!: Date;

  @IsOptional()
  @IsString()
  @Length(0, 1990)
  description?: string;

  @ValidateNested()
  @Type(() => AdjustmentMetaDto)
  adjustmentMeta!: AdjustmentMetaDto;

  @IsArray()
  @ArrayMinSize(2, { message: 'Adjustment needs at least two lines' })
  @ValidateNested({ each: true })
  @Type(() => AdjustmentLineDto)
  lines!: AdjustmentLineDto[];

  @IsOptional()
  @IsString()
  @Length(0, 500)
  sourceRef?: string;
}
