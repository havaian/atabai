import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

import { getFileLimit } from '../common/constants/subscription';
import { AppError } from '../common/errors/app.error';
import { AppLoggerService } from '../common/logger/app-logger.service';
import type { AppConfig } from '../config/configuration';
import { OrganizationsService } from '../organizations/organizations.service';
import type { GoogleProfileInput, IUserMethods, UserDocument, UserModel } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';
import { JwtTokenService } from './jwt-token.service';
import { WhitelistService } from './whitelist.service';

export interface SessionPayload {
  user: {
    id: string;
    email: string;
    name: string;
    picture: string | null;
    role: string;
    subscriptionType: string;
    filesProcessedThisMonth: number;
    filesCompletedThisMonth: number;
  };
  accessToken: string;
  refreshToken: string;
}

/**
 * Auth orchestration — the OAuth callback flow, token refresh, profile fetch,
 * and logout. Equivalent to backend/src/auth/controller.js minus the framing.
 */
@Injectable()
export class AuthService {
  private readonly googleClientId: string;
  private readonly googleClientSecret: string;
  private readonly frontendUrl: string;

  constructor(
    private readonly users: UsersService,
    private readonly tokens: JwtTokenService,
    private readonly whitelist: WhitelistService,
    private readonly configService: ConfigService<AppConfig, true>,
    private readonly logger: AppLoggerService,
    @Inject(forwardRef(() => OrganizationsService))
    private readonly organizations: OrganizationsService,
  ) {
    const google = configService.get('google', { infer: true });
    this.googleClientId = google.clientId ?? '';
    this.googleClientSecret = google.clientSecret ?? '';
    this.frontendUrl = configService.get('frontendUrl', { infer: true });
  }

  // ─── Initiate ───────────────────────────────────────────────────────────────

  buildInitiateUrl(): { success: true; authUrl: string; message: string } {
    if (!this.googleClientId) {
      throw new AppError('Google OAuth not configured', 500, 'OAUTH_INITIATION_FAILED');
    }
    const authUrl =
      `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${this.googleClientId}&` +
      `redirect_uri=${encodeURIComponent(this.frontendUrl)}/api/auth/google/callback&` +
      `response_type=code&scope=profile email&access_type=offline&prompt=consent`;
    return { success: true, authUrl, message: 'Redirect to Google OAuth' };
  }

  // ─── Manual OAuth callback (frontend SPA route) ─────────────────────────────

  async handleManualGoogleCallback(code: string): Promise<SessionPayload & { success: true; message: string }> {
    try {
      // Exchange code for Google access token
      const tokenResponse = await axios.post<{ access_token: string }>(
        'https://oauth2.googleapis.com/token',
        {
          client_id: this.googleClientId,
          client_secret: this.googleClientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: `${this.frontendUrl}/auth/callback`,
        },
      );

      const { access_token } = tokenResponse.data;

      const profileResponse = await axios.get<{
        id: string;
        email: string;
        name: string;
        picture: string;
      }>('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${access_token}` },
      });

      const gp = profileResponse.data;
      const profile: GoogleProfileInput = {
        id: gp.id,
        emails: [{ value: gp.email }],
        displayName: gp.name,
        photos: [{ value: gp.picture }],
      };

      const user = await this.findOrCreateFromGoogle(profile);
      await (user as unknown as IUserMethods).updateLastLogin();
      await this.resolvePendingInvitesQuietly(user);

      const { accessToken, refreshToken } = await this.tokens.generateTokenPair(user);
      const session = this.createSessionPayload(user, accessToken, refreshToken);

      this.logger.logAuth('User logged in successfully', { email: user.email });

      return { success: true, message: 'Login successful', ...session };
    } catch (err) {
      const apiErr = err as Error & {
        code?: string;
        blockedEmail?: string;
        response?: { status?: number; data?: unknown };
      };
      if (apiErr.code === 'WHITELIST_BLOCKED') {
        this.logger.logAuth('Whitelist blocked sign-in', { email: apiErr.blockedEmail });
        throw new AppError(
          'Your email is not authorized to access ATABAI. Please contact the administrator.',
          403,
          'WHITELIST_BLOCKED',
        );
      }
      this.logger.error(err, {
        context: 'Google OAuth callback',
        apiErrorStatus: apiErr.response?.status,
        apiErrorData: apiErr.response?.data,
        category: 'auth-error',
      });
      throw new AppError(
        `OAuth callback failed: ${(err as Error).message}`,
        500,
        'OAUTH_CALLBACK_FAILED',
      );
    }
  }

  // ─── Passport redirect-flow callback ────────────────────────────────────────

  async handlePassportCallback(profile: GoogleProfileInput): Promise<{
    user: UserDocument;
    accessToken: string;
    refreshToken: string;
  }> {
    const user = await this.findOrCreateFromGoogle(profile);
    await (user as unknown as IUserMethods).updateLastLogin();
    await this.resolvePendingInvitesQuietly(user);
    const { accessToken, refreshToken } = await this.tokens.generateTokenPair(user);
    this.logger.logAuth('User logged in (passport redirect)', { email: user.email });
    return { user, accessToken, refreshToken };
  }

  buildPassportRedirectUrl(user: UserDocument, accessToken: string, refreshToken: string): string {
    const payload = {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      subscriptionType: user.subscriptionType,
    };
    return (
      `${this.frontendUrl}/auth/success?` +
      `access_token=${encodeURIComponent(accessToken)}&` +
      `refresh_token=${encodeURIComponent(refreshToken)}&` +
      `user=${encodeURIComponent(JSON.stringify(payload))}`
    );
  }

  buildPassportFailureUrl(): string {
    return `${this.frontendUrl}/login?error=oauth_failed`;
  }

  // ─── Token refresh ──────────────────────────────────────────────────────────

  async refresh(refreshToken: string): Promise<{ success: true; accessToken: string; message: string }> {
    const decoded = this.tokens.decode(refreshToken);
    if (!decoded?.userId) {
      throw new AppError('Invalid refresh token format', 401, 'INVALID_REFRESH_TOKEN');
    }

    const user = await this.users.findByIdWithSecrets(decoded.userId);
    if (!user || !user.isActive) {
      throw new AppError('User not found or inactive', 401, 'USER_NOT_FOUND');
    }

    try {
      await this.tokens.verifyRefreshToken(refreshToken, user);
    } catch (err) {
      const message = (err as Error).message;
      if (message === 'REFRESH_TOKEN_EXPIRED') {
        throw new AppError(
          'Refresh token has expired. Please login again.',
          401,
          'REFRESH_TOKEN_EXPIRED',
        );
      }
      if (message === 'INVALID_REFRESH_TOKEN') {
        throw new AppError('Invalid refresh token', 401, 'INVALID_REFRESH_TOKEN');
      }
      throw new AppError('Failed to refresh token', 500, 'TOKEN_REFRESH_FAILED');
    }

    await (user as unknown as IUserMethods).resetMonthlyCounterIfNeeded();
    const accessToken = await this.tokens.generateAccessToken(user);
    return { success: true, accessToken, message: 'Token refreshed successfully' };
  }

  // ─── Profile ────────────────────────────────────────────────────────────────

  async getProfile(user: UserDocument) {
    const canProcess = await (user as unknown as IUserMethods).canProcessFiles();
    return {
      success: true,
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        picture: user.picture,
        role: user.role,
        subscriptionType: user.subscriptionType,
        filesProcessedThisMonth: user.filesProcessedThisMonth,
        monthlyLimit: getFileLimit(user.subscriptionType),
        canProcessFiles: canProcess,
        preferences: user.preferences,
        lastLoginAt: user.lastLoginAt,
        createdAt: (user as unknown as { createdAt: Date }).createdAt,
      },
    };
  }

  async updateProfile(
    user: UserDocument,
    payload: {
      name?: string;
      preferences?: {
        language?: 'ru' | 'uz' | 'en';
        theme?: 'light' | 'dark' | 'system';
        defaultTemplate?: string;
        notifications?: { email?: boolean; browser?: boolean };
      };
    },
  ): Promise<{ success: true; message: string; user: Record<string, unknown> }> {
    if (payload.name && typeof payload.name === 'string') {
      user.name = payload.name.trim();
    }
    if (payload.preferences && typeof payload.preferences === 'object') {
      const p = payload.preferences;
      if (p.language && (['ru', 'uz', 'en'] as const).includes(p.language)) {
        user.preferences.language = p.language;
      }
      if (p.theme && (['light', 'dark', 'system'] as const).includes(p.theme)) {
        user.preferences.theme = p.theme;
      }
      if (p.notifications && typeof p.notifications === 'object') {
        if (typeof p.notifications.email === 'boolean') {
          user.preferences.notifications.email = p.notifications.email;
        }
        if (typeof p.notifications.browser === 'boolean') {
          user.preferences.notifications.browser = p.notifications.browser;
        }
      }
      if (p.defaultTemplate) user.preferences.defaultTemplate = p.defaultTemplate;
    }
    await user.save();
    this.logger.info(`Profile updated for user: ${user.email}`);

    return {
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        picture: user.picture,
        subscriptionType: user.subscriptionType,
        preferences: user.preferences,
      },
    };
  }

  // ─── Logout ─────────────────────────────────────────────────────────────────

  async logout(user: UserDocument, token: string | undefined): Promise<{ success: true; message: string }> {
    try {
      if (token) {
        const decoded = await this.tokens.verifyAccessToken(token, user);
        const expiresIn = (decoded.exp ?? 0) - Math.floor(Date.now() / 1000);
        if (expiresIn > 0) await this.tokens.revokeToken(token, expiresIn);
      }
    } catch (err) {
      // Don't fail logout on revocation issues — match legacy behavior.
      this.logger.error(err, { context: 'auth/logout token revoke' });
    }
    return { success: true, message: 'Logged out successfully' };
  }

  // ─── Health ─────────────────────────────────────────────────────────────────

  health(): {
    success: true;
    service: 'auth';
    status: 'healthy';
    timestamp: string;
    features: { googleOAuth: boolean; jwtAuth: boolean; tokenRefresh: boolean };
  } {
    const jwt = this.configService.get('jwt', { infer: true });
    return {
      success: true,
      service: 'auth',
      status: 'healthy',
      timestamp: new Date().toISOString(),
      features: {
        googleOAuth: !!this.googleClientId,
        jwtAuth: !!jwt.accessSecret,
        tokenRefresh: !!jwt.refreshSecret,
      },
    };
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  createSessionPayload(user: UserDocument, accessToken: string, refreshToken: string): SessionPayload {
    return {
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        picture: user.picture,
        role: user.role,
        subscriptionType: user.subscriptionType,
        filesProcessedThisMonth: user.filesProcessedThisMonth,
        filesCompletedThisMonth: user.filesCompletedThisMonth,
      },
      accessToken,
      refreshToken,
    };
  }

  private async findOrCreateFromGoogle(profile: GoogleProfileInput): Promise<UserDocument> {
    const model = this.users.getModel() as UserModel;
    return model.findOrCreateFromGoogle(profile, {
      adminEmails: this.configService.get('admin.emails', { infer: true }),
      whitelistEnabled: this.whitelist.isEnabled(),
      isEmailAllowed: (email) => this.whitelist.isEmailAllowed(email),
    });
  }

  /**
   * Stamp the userId onto any Memberships pending against this user's email
   * (architecture doc §7.6 invite-accept). Failures are logged but never block
   * login — the user can still resolve invites later from the dashboard.
   */
  private async resolvePendingInvitesQuietly(user: UserDocument): Promise<void> {
    try {
      await this.organizations.resolvePendingInvitesForUser(user);
    } catch (err) {
      this.logger.error(err, {
        context: 'auth.resolvePendingInvitesQuietly',
        userId: user._id.toString(),
        email: user.email,
      });
    }
  }
}
