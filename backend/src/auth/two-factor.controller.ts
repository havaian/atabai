import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';

import type { UserDocument } from '../users/schemas/user.schema';
import { CurrentUser } from './decorators/current-user.decorator';
import { Roles } from './decorators/roles.decorator';
import { TwoFactorCodeDto } from './dto/two-factor.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { TwoFactorService } from './two-factor.service';

/**
 * /api/admin/2fa/* - TOTP enrollment, verification, disable, backup-code mgmt.
 *
 * Mounted at /admin/2fa so the URL surface matches the legacy backend (the
 * frontend admin store keys off these exact paths). Only admin / super_admin
 * roles can hit these - but the AdminVerifiedGuard is NOT applied because
 * these endpoints are precisely what creates the session that guard requires.
 */
@Controller('admin/2fa')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'super_admin')
export class TwoFactorController {
  constructor(private readonly twoFactor: TwoFactorService) {}

  @Get('status')
  getStatus(@CurrentUser() user: UserDocument) {
    return this.twoFactor.getStatus(user);
  }

  @Post('setup')
  @HttpCode(200)
  setup(@CurrentUser() user: UserDocument) {
    return this.twoFactor.setup(user);
  }

  @Post('confirm')
  @HttpCode(200)
  confirm(
    @CurrentUser() user: UserDocument,
    @Body() body: TwoFactorCodeDto,
    @Req() req: Request,
  ) {
    return this.twoFactor.confirm(user, body.code, req.ip ?? null, req.get('User-Agent') ?? null);
  }

  @Post('verify')
  @HttpCode(200)
  verify(
    @CurrentUser() user: UserDocument,
    @Body() body: TwoFactorCodeDto,
    @Req() req: Request,
  ) {
    return this.twoFactor.verify(user, body.code, req.ip ?? null, req.get('User-Agent') ?? null);
  }

  @Post('logout')
  @HttpCode(204)
  async logoutSession(@CurrentUser() user: UserDocument, @Req() req: Request): Promise<void> {
    await this.twoFactor.logoutSession(user, req.get('X-Admin-Session') ?? undefined);
  }

  @Post('disable')
  @HttpCode(200)
  disable(@CurrentUser() user: UserDocument, @Body() body: TwoFactorCodeDto) {
    return this.twoFactor.disable(user, body.code);
  }

  @Post('backup-codes/regenerate')
  @HttpCode(200)
  regenerateBackupCodes(@CurrentUser() user: UserDocument, @Body() body: TwoFactorCodeDto) {
    return this.twoFactor.regenerateBackupCodes(user, body.code);
  }
}
