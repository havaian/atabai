import { Controller, Get, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { UserDocument } from '../users/schemas/user.schema';

/**
 * /api/admin - admin self info endpoint.
 *
 * Mounted at base of /api/admin (NOT behind AdminVerifiedGuard) so the
 * frontend can detect whether the user has admin role + whether 2FA enrollment
 * is needed. Everything else under /api/admin/* requires AdminVerifiedGuard.
 */
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'super_admin')
export class AdminController {
  @Get('me')
  getMe(@CurrentUser() user: UserDocument) {
    return {
      success: true,
      admin: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
        totpEnabled: !!user.totpEnabled,
      },
    };
  }
}
