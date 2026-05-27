import {
  ArrayUnique,
  IsArray,
  IsEmail,
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

export class InviteMemberDto {
  @IsEmail({}, { message: 'A valid email is required to invite' })
  email!: string;

  @IsIn(MEMBERSHIP_ROLES, { message: "Role must be 'admin' or 'member'" })
  role!: MembershipRole;

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
