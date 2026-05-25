import { IsString, MinLength } from 'class-validator';

export class GoogleCallbackDto {
  @IsString()
  @MinLength(10, { message: 'Invalid authorization code format' })
  code!: string;
}
