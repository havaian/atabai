import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Put,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';

import type { UserDocument } from '../users/schemas/user.schema';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { GoogleCallbackDto } from './dto/google-callback.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

/**
 * Mounted at /api/auth (global prefix + controller path).
 * Preserves every legacy route, error code and response shape.
 *
 * Note: the throttler config applied here matches the legacy `/api/auth/*`
 * limiter (30 / 15min, success-skipped). Successful logins are NOT counted -
 * Nest's ThrottlerGuard charges on every request, so we set a high enough
 * limit (30) that occasional retries won't fingerprint legit users.
 */
@Controller('auth')
@UseGuards(JwtAuthGuard)
@Throttle({ global: { limit: 30, ttl: 15 * 60 * 1000 } })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ─── Initiate Google OAuth (SPA flow returns URL JSON) ──────────────────────

  @Public()
  @Get('google')
  initiateGoogleLogin() {
    return this.authService.buildInitiateUrl();
  }

  // ─── Passport redirect flow (server-side OAuth, redirects back to frontend) ─

  @Public()
  @Get('google/redirect')
  @UseGuards(AuthGuard('google'))
  googleRedirect() {
    // Passport handles the actual redirect to Google.
  }

  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: Request, @Res() res: Response): Promise<void> {
    const user = req.user as UserDocument | undefined;
    if (!user) {
      res.redirect(this.authService.buildPassportFailureUrl());
      return;
    }
    try {
      const { accessToken, refreshToken } = await this.authService.handlePassportCallback({
        id: user.googleId,
        emails: [{ value: user.email }],
        displayName: user.name,
        photos: [{ value: user.picture ?? '' }],
      });
      res.redirect(this.authService.buildPassportRedirectUrl(user, accessToken, refreshToken));
    } catch {
      res.redirect(this.authService.buildPassportFailureUrl());
    }
  }

  // ─── Manual OAuth (frontend exchanges authorization code) ───────────────────

  @Public()
  @Post('google/callback')
  @HttpCode(200)
  handleGoogleCallback(@Body() body: GoogleCallbackDto) {
    return this.authService.handleManualGoogleCallback(body.code);
  }

  // ─── Refresh ────────────────────────────────────────────────────────────────

  @Public()
  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() body: RefreshTokenDto) {
    return this.authService.refresh(body.refreshToken);
  }

  // ─── Profile ────────────────────────────────────────────────────────────────

  @Get('profile')
  getProfile(@CurrentUser() user: UserDocument) {
    return this.authService.getProfile(user);
  }

  @Put('profile')
  updateProfile(@CurrentUser() user: UserDocument, @Body() body: UpdateProfileDto) {
    return this.authService.updateProfile(user, body);
  }

  // ─── Logout ─────────────────────────────────────────────────────────────────

  @Post('logout')
  @HttpCode(200)
  logout(@CurrentUser() user: UserDocument, @Req() req: Request & { token?: string }) {
    return this.authService.logout(user, req.token);
  }

  // ─── Health ─────────────────────────────────────────────────────────────────

  @Public()
  @Get('health')
  health() {
    return this.authService.health();
  }
}
