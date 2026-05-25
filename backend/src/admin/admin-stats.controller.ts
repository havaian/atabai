import { Controller, Get, UseGuards } from '@nestjs/common';

import { Roles } from '../auth/decorators/roles.decorator';
import { AdminVerifiedGuard } from '../auth/guards/admin-verified.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminStatsService } from './admin-stats.service';

@Controller('admin/stats')
@UseGuards(JwtAuthGuard, RolesGuard, AdminVerifiedGuard)
@Roles('admin', 'super_admin')
export class AdminStatsController {
  constructor(private readonly stats: AdminStatsService) {}

  @Get()
  getStats() {
    return this.stats.getStats();
  }
}
