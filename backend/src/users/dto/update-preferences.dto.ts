import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

class NotifPrefsDto {
  @IsOptional() @IsBoolean() email?: boolean;
  @IsOptional() @IsBoolean() browser?: boolean;
}

export class PreferencesPayloadDto {
  @IsOptional() @IsIn(['ru', 'uz', 'en'])
  language?: 'ru' | 'uz' | 'en';

  @IsOptional() @IsIn(['light', 'dark', 'system'])
  theme?: 'light' | 'dark' | 'system';

  @IsOptional() @IsString()
  defaultTemplate?: string;

  @IsOptional() @ValidateNested() @Type(() => NotifPrefsDto)
  notifications?: NotifPrefsDto;
}

export class UpdatePreferencesDto {
  @IsObject() @ValidateNested() @Type(() => PreferencesPayloadDto)
  preferences!: PreferencesPayloadDto;
}
