import { IsNotEmpty, IsString } from 'class-validator';

export class TwoFactorCodeDto {
  @IsString()
  @IsNotEmpty({ message: 'Code is required' })
  code!: string;
}
