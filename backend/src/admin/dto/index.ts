import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

import type { UserRole } from '../../users/schemas/user.schema';

// ─── Users ──────────────────────────────────────────────────────────────────

export class UpdateRoleDto {
  @IsIn(['user', 'admin', 'super_admin'])
  role!: UserRole;
}

export class UpdateActiveDto {
  @IsBoolean()
  isActive!: boolean;
}

export class UpdateSubscriptionDto {
  @IsIn(['basic', 'premium'])
  subscriptionType!: 'basic' | 'premium';

  @IsOptional()
  @IsDateString()
  subscriptionExpiresAt?: string | null;
}

// ─── Whitelist ──────────────────────────────────────────────────────────────

export class AddWhitelistEntryDto {
  @IsEmail()
  email!: string;

  @IsOptional() @IsString()
  note?: string;
}

export class BulkAddWhitelistDto {
  @IsArray() @ArrayNotEmpty()
  @IsString({ each: true })
  emails!: string[];

  @IsOptional() @IsString()
  note?: string;
}

// ─── Locales ────────────────────────────────────────────────────────────────

class LocaleValuesDto {
  @IsOptional() @IsString() ru?: string | null;
  @IsOptional() @IsString() en?: string | null;
  @IsOptional() @IsString() uz?: string | null;
}

export class CreateLocaleKeyDto {
  @IsString() key!: string;
  @IsIn(['user', 'admin']) app!: 'user' | 'admin';
  @IsOptional() @IsObject() @ValidateNested() @Type(() => LocaleValuesDto)
  values?: LocaleValuesDto;
  @IsOptional() @IsString() notes?: string;
}

export class UpdateLocaleKeyDto {
  @IsOptional() @IsObject() @ValidateNested() @Type(() => LocaleValuesDto)
  values?: LocaleValuesDto;
  @IsOptional() @IsString() notes?: string;
}

// ─── Mapping sets ───────────────────────────────────────────────────────────

export class UpdateMappingSetScopeDto {
  @IsOptional() @IsArray() @IsString({ each: true })
  assignedUsers?: string[];
  @IsOptional() @IsString()
  label?: string;
}

export class CreateBlankDraftDto {
  @IsArray() @ArrayMinSize(1) @IsString({ each: true })
  assignedUsers!: string[];
  @IsOptional() @IsString() label?: string;
}

export class ForkSetDto {
  @IsOptional() @IsArray() @IsString({ each: true })
  assignedUsers?: string[];
  @IsOptional() @IsString() label?: string;
}

export class PublishDraftDto {
  @IsOptional() @IsString() notes?: string;
}

// ─── List query ─────────────────────────────────────────────────────────────

export class PaginationQueryDto {
  @IsOptional() @IsInt() @Min(1) @Type(() => Number)
  page?: number;

  @IsOptional() @IsInt() @Min(1) @Type(() => Number)
  limit?: number;
}
