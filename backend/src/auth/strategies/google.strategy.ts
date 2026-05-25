import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy, VerifyCallback } from 'passport-google-oauth20';

import { AppLoggerService } from '../../common/logger/app-logger.service';
import type { AppConfig } from '../../config/configuration';
import type { UserDocument, UserModel } from '../../users/schemas/user.schema';
import { UsersService } from '../../users/users.service';
import { WhitelistService } from '../whitelist.service';

/**
 * Google OAuth2 passport strategy — used by the `/api/auth/google` redirect
 * flow (the legacy backend also supports a frontend-driven manual code
 * exchange, handled by AuthService.handleManualGoogleCallback).
 *
 * Whitelist denial is surfaced via Passport's `info` channel so the callback
 * controller can redirect with a friendly message instead of a 500.
 */
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    configService: ConfigService<AppConfig, true>,
    private readonly users: UsersService,
    private readonly whitelist: WhitelistService,
    private readonly logger: AppLoggerService,
  ) {
    const google = configService.get('google', { infer: true });
    super({
      clientID: google.clientId ?? '',
      clientSecret: google.clientSecret ?? '',
      callbackURL: google.callbackPath,
      scope: ['profile', 'email'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<void> {
    try {
      const model = this.users.getModel() as UserModel;
      const user = (await model.findOrCreateFromGoogle(profile, {
        adminEmails: [], // populated by AuthService for SPA flow; passport-redirect uses env directly
        whitelistEnabled: this.whitelist.isEnabled(),
        isEmailAllowed: (email) => this.whitelist.isEmailAllowed(email),
      })) as UserDocument;
      done(null, user);
    } catch (err) {
      const apiErr = err as Error & { code?: string; blockedEmail?: string };
      if (apiErr.code === 'WHITELIST_BLOCKED') {
        done(null, false, { message: 'WHITELIST_BLOCKED' });
        return;
      }
      this.logger.error(err, { context: 'GoogleStrategy.validate' });
      done(err as Error, undefined);
    }
  }
}
