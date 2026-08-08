import { forwardRef, Module, OnApplicationBootstrap } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';

import { OrganizationsModule } from '../organizations/organizations.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AdminVerifiedGuard } from './guards/admin-verified.guard';
import { FileProcessingLimitGuard } from './guards/file-processing-limit.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from './guards/optional-jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { JwtTokenService } from './jwt-token.service';
import { AdminSession, AdminSessionSchema } from './schemas/admin-session.schema';
import { EmailWhitelist, EmailWhitelistSchema } from './schemas/email-whitelist.schema';
import { GoogleStrategy } from './strategies/google.strategy';
import { TwoFactorController } from './two-factor.controller';
import { TwoFactorService } from './two-factor.service';
import { WhitelistService } from './whitelist.service';

@Module({
  imports: [
    forwardRef(() => UsersModule),
    forwardRef(() => OrganizationsModule),
    PassportModule.register({ session: false }),
    MongooseModule.forFeature([
      { name: AdminSession.name, schema: AdminSessionSchema },
      { name: EmailWhitelist.name, schema: EmailWhitelistSchema },
    ]),
  ],
  controllers: [AuthController, TwoFactorController],
  providers: [
    AuthService,
    JwtTokenService,
    WhitelistService,
    TwoFactorService,
    GoogleStrategy,
    JwtAuthGuard,
    OptionalJwtAuthGuard,
    RolesGuard,
    AdminVerifiedGuard,
    FileProcessingLimitGuard,
  ],
  exports: [
    AuthService,
    JwtTokenService,
    WhitelistService,
    TwoFactorService,
    JwtAuthGuard,
    OptionalJwtAuthGuard,
    RolesGuard,
    AdminVerifiedGuard,
    FileProcessingLimitGuard,
    MongooseModule,
  ],
})
export class AuthModule implements OnApplicationBootstrap {
  constructor(private readonly whitelist: WhitelistService) {}

  /**
   * Idempotent startup seed - auto-seeds the email whitelist from existing
   * users on first enable so we don't lock anyone out.
   */
  async onApplicationBootstrap(): Promise<void> {
    await this.whitelist.runBootstrapAtStartup();
  }
}
