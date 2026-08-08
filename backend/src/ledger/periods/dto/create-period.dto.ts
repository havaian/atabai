import { Transform } from 'class-transformer';
import { IsDate, IsString, Length } from 'class-validator';

/**
 * Payload for creating a regular reporting period after first-time adoption.
 * The opening / comparative / reporting triple comes from the bootstrap
 * flow - this DTO is for adding subsequent fiscal periods.
 */
export class CreatePeriodDto {
  @IsString()
  @Length(1, 100, { message: 'label is required (1–100 chars)' })
  label!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' || value instanceof Date ? new Date(value) : value,
  )
  @IsDate({ message: 'startDate must be a valid date' })
  startDate!: Date;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' || value instanceof Date ? new Date(value) : value,
  )
  @IsDate({ message: 'endDate must be a valid date' })
  endDate!: Date;
}
