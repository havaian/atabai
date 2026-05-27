import { Transform } from 'class-transformer';
import {
  IsDate,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  Matches,
} from 'class-validator';

/**
 * Payload for the one-shot ledger bootstrap (LedgerBootstrapService).
 *
 * Required:
 *   - name: access-spine display name for the org
 *   - transitionDate: first-time IFRS adoption boundary (architecture doc §7.3)
 *   - firstReportingYear: the calendar year of the first FULL reporting set
 *
 * Optional metadata that lands on OrganizationProfile:
 *   - legalName, inn, baseCurrency
 */
export class BootstrapOrganizationDto {
  @IsString()
  @Length(1, 255, { message: 'Organization name must be between 1 and 255 characters' })
  name!: string;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  legalName?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{9,14}$/, {
    message: 'ИНН must be 9–14 digits',
  })
  inn?: string;

  @IsOptional()
  @IsString()
  @Length(3, 3, { message: 'baseCurrency must be a 3-letter ISO code' })
  baseCurrency?: string;

  // Accepts an ISO date string from the client; class-transformer reifies it.
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' || value instanceof Date ? new Date(value) : value,
  )
  @IsDate({ message: 'transitionDate must be a valid date' })
  transitionDate!: Date;

  @IsInt({ message: 'firstReportingYear must be an integer' })
  @Min(1900, { message: 'firstReportingYear must be at or after 1900' })
  @Max(2100, { message: 'firstReportingYear must be at or before 2100' })
  firstReportingYear!: number;
}
