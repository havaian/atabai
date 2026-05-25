import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  Length,
  ValidateNested,
} from 'class-validator';

class NotificationPrefsDto {
  @IsOptional()
  @IsBoolean()
  email?: boolean;

  @IsOptional()
  @IsBoolean()
  browser?: boolean;
}

class PreferencesDto {
  @IsOptional()
  @IsIn(['ru', 'uz', 'en'], { message: 'Language must be ru, uz, or en' })
  language?: 'ru' | 'uz' | 'en';

  @IsOptional()
  @IsIn(['light', 'dark', 'system'])
  theme?: 'light' | 'dark' | 'system';

  @IsOptional()
  @IsString()
  defaultTemplate?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationPrefsDto)
  notifications?: NotificationPrefsDto;
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @Length(1, 100, { message: 'Name must be between 1 and 100 characters' })
  name?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PreferencesDto)
  preferences?: PreferencesDto;
}
