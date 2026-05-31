import { IsString, Length } from 'class-validator';

export class ReverseReclassificationDto {
  /**
   * Why the original reclassification is being reversed. Required — it lands
   * in the audit trail and the reversal entry's description. Empty reasons
   * defeat the point of an append-only model (keeping the history visible).
   */
  @IsString()
  @Length(1, 1000, { message: 'reason is required' })
  reason!: string;
}
