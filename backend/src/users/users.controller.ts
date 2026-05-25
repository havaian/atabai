import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { getFileLimit } from '../common/constants/subscription';
import { AppLoggerService } from '../common/logger/app-logger.service';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import type { IUserMethods, UserDocument } from './schemas/user.schema';

/**
 * Mounted at /api/users. Ports backend/src/user/routes.js — `/me`, `/stats`,
 * and `PATCH /preferences`.
 */
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly logger: AppLoggerService) {}

  @Get('me')
  getMe(@CurrentUser() user: UserDocument) {
    return {
      success: true,
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

  @Get('stats')
  async getStats(@CurrentUser() user: UserDocument) {
    const canProcess = await (user as unknown as IUserMethods).canProcessFiles();
    return {
      success: true,
      stats: {
        filesProcessedThisMonth: user.filesProcessedThisMonth,
        monthlyLimit:
          user.subscriptionType === 'basic' ? getFileLimit('basic') : 'unlimited',
        subscriptionType: user.subscriptionType,
        canProcessFiles: canProcess,
        memberSince: (user as unknown as { createdAt: Date }).createdAt,
      },
    };
  }

  @Patch('preferences')
  async updatePreferences(
    @CurrentUser() user: UserDocument,
    @Body() body: UpdatePreferencesDto,
  ) {
    const p = body.preferences;
    if (p.language) user.preferences.language = p.language;
    if (p.theme) user.preferences.theme = p.theme;
    if (p.defaultTemplate !== undefined) user.preferences.defaultTemplate = p.defaultTemplate;
    if (p.notifications) Object.assign(user.preferences.notifications, p.notifications);

    try {
      await user.save();
      return {
        success: true,
        message: 'Preferences updated successfully',
        preferences: user.preferences,
      };
    } catch (err) {
      this.logger.error(err, { context: 'users.updatePreferences' });
      return { success: false, error: 'Failed to update preferences' };
    }
  }
}
