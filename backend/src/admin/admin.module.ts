import { Module, OnApplicationBootstrap } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AuthModule } from '../auth/auth.module';
import { File, FileSchema } from '../files/schemas/file.schema';
import { MappingSeedService } from '../mappings/mapping-seed.service';
import { MappingsModule } from '../mappings/mappings.module';
import { User, UserSchema } from '../users/schemas/user.schema';
import { UsersModule } from '../users/users.module';

import { AdminController } from './admin.controller';
import { AdminFilesController } from './admin-files.controller';
import { AdminFilesService } from './admin-files.service';
import { AdminLocalesController } from './admin-locales.controller';
import { AdminLocalesService } from './admin-locales.service';
import { AdminMappingsController } from './admin-mappings.controller';
import { AdminMappingsService } from './admin-mappings.service';
import { AdminStatsController } from './admin-stats.controller';
import { AdminStatsService } from './admin-stats.service';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';
import { AdminWhitelistController } from './admin-whitelist.controller';
import { AdminWhitelistService } from './admin-whitelist.service';
import { LocaleBundleService } from './locale-bundle.service';
import { LocaleSeedService } from './locale-seed.service';
import { PublicLocalesController } from './public-locales.controller';
import { LocaleKey, LocaleKeySchema } from './schemas/locale-key.schema';

/**
 * Admin domain — gathers admin-only HTTP surface (users, files, stats,
 * whitelist, locales, mappings) and the public locale bundle endpoints.
 * AuthModule supplies the guards we apply to every controller.
 */
@Module({
  imports: [
    AuthModule,
    UsersModule,
    MappingsModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: File.name, schema: FileSchema },
      { name: LocaleKey.name, schema: LocaleKeySchema },
    ]),
  ],
  controllers: [
    AdminController,
    AdminStatsController,
    AdminUsersController,
    AdminFilesController,
    AdminWhitelistController,
    AdminLocalesController,
    AdminMappingsController,
    PublicLocalesController,
  ],
  providers: [
    AdminStatsService,
    AdminUsersService,
    AdminFilesService,
    AdminWhitelistService,
    AdminLocalesService,
    AdminMappingsService,
    LocaleSeedService,
    LocaleBundleService,
  ],
  exports: [
    AdminStatsService,
    AdminUsersService,
    AdminFilesService,
    AdminWhitelistService,
    AdminLocalesService,
    AdminMappingsService,
    LocaleSeedService,
    LocaleBundleService,
    MongooseModule,
  ],
})
export class AdminModule implements OnApplicationBootstrap {
  constructor(
    private readonly localeSeed: LocaleSeedService,
    private readonly mappingSeed: MappingSeedService,
  ) {}

  /**
   * Idempotent startup seeds — preserved from the legacy src/index.js bootstrap.
   * Mapping seed runs first so the resolver has DB data; locales follow.
   * Both are best-effort: errors log but don't block startup.
   */
  async onApplicationBootstrap(): Promise<void> {
    await this.mappingSeed.runSeedAtStartup();
    await this.localeSeed.runSeedAtStartup();
  }
}
