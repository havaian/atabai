import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AdminVerifiedGuard } from '../auth/guards/admin-verified.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { UserDocument } from '../users/schemas/user.schema';
import { AdminMappingsService } from './admin-mappings.service';
import {
  CreateBlankDraftDto,
  ForkSetDto,
  PublishDraftDto,
  UpdateMappingSetScopeDto,
} from './dto';

/**
 * /api/admin/mappings/* — full CRUD on MappingSets, RowMappings, and the
 * EquityMappingConfig. Mirrors the legacy route surface exactly so the
 * frontend admin store (`useAdminStore.listMappingSets` etc.) doesn't need
 * any path changes.
 *
 * All routes require JWT + admin role + a verified admin session (2FA).
 * Mutations additionally require super_admin.
 */
@Controller('admin/mappings')
@UseGuards(JwtAuthGuard, RolesGuard, AdminVerifiedGuard)
@Roles('admin', 'super_admin')
export class AdminMappingsController {
  constructor(private readonly mappings: AdminMappingsService) {}

  @Get()
  list() {
    return this.mappings.listMappingSets();
  }

  @Post('seed')
  @Roles('super_admin')
  @HttpCode(200)
  manualSeed(@CurrentUser() admin: UserDocument) {
    return this.mappings.manualSeed(admin._id, admin.email);
  }

  @Get(':reportType/published')
  getPublished(@Param('reportType') reportType: string) {
    return this.mappings.getPublishedSet(reportType);
  }

  @Get(':reportType/draft')
  getDraft(@Param('reportType') reportType: string) {
    return this.mappings.getDraftSet(reportType);
  }

  @Post(':reportType/draft')
  @Roles('super_admin')
  @HttpCode(200)
  createDraftFromPublished(
    @CurrentUser() admin: UserDocument,
    @Param('reportType') reportType: string,
  ) {
    return this.mappings.createDraftFromPublished(reportType, admin._id);
  }

  @Post(':reportType/blank-draft')
  @Roles('super_admin')
  @HttpCode(200)
  createBlankDraft(
    @CurrentUser() admin: UserDocument,
    @Param('reportType') reportType: string,
    @Body() body: CreateBlankDraftDto,
  ) {
    return this.mappings.createBlankDraft(reportType, admin._id, body);
  }

  @Get('sets/:setId')
  getById(@Param('setId') setId: string) {
    return this.mappings.getSetById(setId);
  }

  @Post('sets/:setId/publish')
  @Roles('super_admin')
  @HttpCode(200)
  publish(
    @CurrentUser() admin: UserDocument,
    @Param('setId') setId: string,
    @Body() body: PublishDraftDto,
  ) {
    return this.mappings.publishDraft(setId, admin._id, admin.email, body.notes);
  }

  @Post('sets/:setId/fork')
  @Roles('super_admin')
  @HttpCode(200)
  fork(
    @CurrentUser() admin: UserDocument,
    @Param('setId') setId: string,
    @Body() body: ForkSetDto,
  ) {
    return this.mappings.forkSet(setId, admin._id, body);
  }

  @Patch('sets/:setId/scope')
  @Roles('super_admin')
  updateScope(@Param('setId') setId: string, @Body() body: UpdateMappingSetScopeDto) {
    return this.mappings.updateSetScope(setId, body);
  }

  @Delete('sets/:setId')
  @Roles('super_admin')
  deleteSet(@CurrentUser() admin: UserDocument, @Param('setId') setId: string) {
    return this.mappings.deleteSet(setId, admin._id);
  }

  // Row editing — row-based report types only.
  @Post('sets/:setId/rows')
  @Roles('super_admin')
  @HttpCode(200)
  addRow(@Param('setId') setId: string, @Body() body: Record<string, unknown>) {
    return this.mappings.addRow(setId, body);
  }

  @Patch('rows/:rowId')
  @Roles('super_admin')
  updateRow(@Param('rowId') rowId: string, @Body() body: Record<string, unknown>) {
    return this.mappings.updateRow(rowId, body);
  }

  @Delete('rows/:rowId')
  @Roles('super_admin')
  deleteRow(@Param('rowId') rowId: string) {
    return this.mappings.deleteRow(rowId);
  }

  // Equity — replace-all of the per-set config doc.
  @Put('sets/:setId/equity')
  @Roles('super_admin')
  updateEquity(@Param('setId') setId: string, @Body() body: Record<string, unknown>) {
    return this.mappings.updateEquityConfig(setId, body);
  }
}
