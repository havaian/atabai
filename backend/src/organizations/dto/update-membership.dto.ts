import {
  ArrayUnique,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
} from 'class-validator';

import {
  ALL_MEMBERSHIP_CAPABILITIES,
  type MembershipCapability,
} from '../constants/membership-capabilities';
import {
  MEMBERSHIP_ROLES,
  type MembershipRole,
} from '../schemas/membership.schema';

/**
 * Both fields optional — empty body is rejected at the service layer so this
 * stays a partial-update shape without each field repeating the validation.
 */
export class UpdateMembershipDto {
  @IsOptional()
  @IsIn(MEMBERSHIP_ROLES, { message: "Role must be 'admin' or 'member'" })
  role?: MembershipRole;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @IsIn(ALL_MEMBERSHIP_CAPABILITIES as readonly string[], {
    each: true,
    message: 'Unknown capability',
  })
  capabilities?: MembershipCapability[];
}
