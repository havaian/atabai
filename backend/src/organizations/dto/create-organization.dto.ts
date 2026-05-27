import { IsString, Length } from 'class-validator';

export class CreateOrganizationDto {
  @IsString()
  @Length(1, 255, { message: 'Organization name must be between 1 and 255 characters' })
  name!: string;
}
