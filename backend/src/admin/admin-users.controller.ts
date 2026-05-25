import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AdminVerifiedGuard } from '../auth/guards/admin-verified.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { UserDocument } from '../users/schemas/user.schema';
import { AdminUsersService } from './admin-users.service';
import { UpdateActiveDto, UpdateRoleDto, UpdateSubscriptionDto } from './dto';

@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard, AdminVerifiedGuard)
@Roles('admin', 'super_admin')
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  @Get()
  list(
    @Query('q') q?: string,
    @Query('role') role?: string,
    @Query('isActive') isActive?: string,
    @Query('subscription') subscription?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sort') sort?: string,
    @Query('order') order?: 'asc' | 'desc',
  ) {
    return this.users.listUsers({
      q,
      role,
      isActive,
      subscription,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      sort,
      order,
    });
  }

  @Get(':userId')
  getDetails(@Param('userId') userId: string) {
    return this.users.getUserDetails(userId);
  }

  @Get(':userId/files')
  getUserFiles(
    @Param('userId') userId: string,
    @Query('status') status?: string,
    @Query('templateType') templateType?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.users.getUserFiles(userId, {
      status,
      templateType,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Patch(':userId/role')
  @Roles('super_admin')
  updateRole(
    @CurrentUser() admin: UserDocument,
    @Param('userId') userId: string,
    @Body() body: UpdateRoleDto,
  ) {
    return this.users.updateUserRole(admin._id, userId, body.role);
  }

  @Patch(':userId/active')
  @Roles('super_admin')
  updateActive(
    @CurrentUser() admin: UserDocument,
    @Param('userId') userId: string,
    @Body() body: UpdateActiveDto,
  ) {
    return this.users.updateUserActive(admin._id, userId, body.isActive);
  }

  @Patch(':userId/subscription')
  @Roles('super_admin')
  updateSubscription(
    @CurrentUser() admin: UserDocument,
    @Param('userId') userId: string,
    @Body() body: UpdateSubscriptionDto,
  ) {
    return this.users.updateUserSubscription(
      admin._id,
      userId,
      body.subscriptionType,
      body.subscriptionExpiresAt ?? null,
    );
  }
}
