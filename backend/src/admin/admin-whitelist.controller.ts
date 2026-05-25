import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AdminVerifiedGuard } from '../auth/guards/admin-verified.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { UserDocument } from '../users/schemas/user.schema';
import { AdminWhitelistService } from './admin-whitelist.service';
import { AddWhitelistEntryDto, BulkAddWhitelistDto } from './dto';

@Controller('admin/whitelist')
@UseGuards(JwtAuthGuard, RolesGuard, AdminVerifiedGuard)
@Roles('admin', 'super_admin')
export class AdminWhitelistController {
  constructor(private readonly service: AdminWhitelistService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Post()
  @Roles('super_admin')
  @HttpCode(201)
  addEntry(@CurrentUser() admin: UserDocument, @Body() body: AddWhitelistEntryDto) {
    return this.service.addEntry(admin._id, body.email, body.note);
  }

  @Post('bulk')
  @Roles('super_admin')
  @HttpCode(200)
  bulkAdd(@CurrentUser() admin: UserDocument, @Body() body: BulkAddWhitelistDto) {
    return this.service.bulkAdd(admin._id, body.emails, body.note);
  }

  @Delete(':entryId')
  @Roles('super_admin')
  remove(@CurrentUser() admin: UserDocument, @Param('entryId') entryId: string) {
    return this.service.removeEntry(admin._id, entryId);
  }
}
