import { Module, OnApplicationBootstrap } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AuthModule } from '../auth/auth.module';
import { User, UserSchema } from '../users/schemas/user.schema';
import { UsersModule } from '../users/users.module';

import { AdminController } from './admin.controller';
import { AdminLocalesController } from './admin-locales.controller';
import { AdminLocalesService } from './admin-locales.service';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';
import { AdminWhitelistController } from './admin-whitelist.controller';
import { AdminWhitelistService } from './admin-whitelist.service';
import { LocaleBundleService } from './locale-bundle.service';
import { LocaleSeedService } from './locale-seed.service';
import { PublicLocalesController } from './public-locales.controller';
import { LocaleKey, LocaleKeySchema } from './schemas/locale-key.schema';

/**
 * Admin domain — gathers admin-only HTTP surface (users, whitelist, locales)
 * and the public locale bundle endpoints. AuthModule supplies the guards we
 * apply to every controller.
 *
 * Scope note: the file-browser, file/transformation stats, and IFRS mapping
 * editor were removed with the transformation pipeline; this module now covers
 * user management, whitelist, and the locale (i18n-in-DB) system only.
 */
@Module({
  imports: [
    AuthModule,
    UsersModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: LocaleKey.name, schema: LocaleKeySchema },
    ]),
  ],
  controllers: [
    AdminController,
    AdminUsersController,
    AdminWhitelistController,
    AdminLocalesController,
    PublicLocalesController,
  ],
  providers: [
    AdminUsersService,
    AdminWhitelistService,
    AdminLocalesService,
    LocaleSeedService,
    LocaleBundleService,
  ],
  exports: [
    AdminUsersService,
    AdminWhitelistService,
    AdminLocalesService,
    LocaleSeedService,
    LocaleBundleService,
    MongooseModule,
  ],
})
export class AdminModule implements OnApplicationBootstrap {
  constructor(private readonly localeSeed: LocaleSeedService) {}

  /**
   * Idempotent startup seed — locale keys. Best-effort: errors log but don't
   * block startup. (The mapping seed was removed with the mappings module.)
   */
  async onApplicationBootstrap(): Promise<void> {
    await this.localeSeed.runSeedAtStartup();
  }
}
