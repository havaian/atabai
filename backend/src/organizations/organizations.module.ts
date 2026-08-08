import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { OrgMembershipGuard } from './guards/org-membership.guard';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';
import { Membership, MembershipSchema } from './schemas/membership.schema';
import { Organization, OrganizationSchema } from './schemas/organization.schema';

/**
 * Owns the Organization + Membership Mongoose models, the OrgMembershipGuard,
 * the REST surface (/api/organizations) and the registration-time pending-invite
 * resolver. AuthModule injects OrganizationsService back into AuthService to
 * call resolvePendingInvitesForUser after Google login - hence the forwardRef.
 *
 * Any feature module that protects routes with OrgMembershipGuard (or queries
 * memberships directly) must import OrganizationsModule.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Organization.name, schema: OrganizationSchema },
      { name: Membership.name, schema: MembershipSchema },
    ]),
    UsersModule,
    forwardRef(() => AuthModule),
  ],
  controllers: [OrganizationsController],
  providers: [OrganizationsService, OrgMembershipGuard],
  exports: [MongooseModule, OrganizationsService, OrgMembershipGuard],
})
export class OrganizationsModule {}
