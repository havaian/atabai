import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import type { AppConfig } from '../config/configuration';
import { UsersService } from '../users/users.service';
import { EmailWhitelist, type EmailWhitelistDocument } from './schemas/email-whitelist.schema';

/**
 * Email whitelist gate for sign-in. When ENABLE_EMAIL_WHITELIST=true, only
 * emails present in the EmailWhitelist collection can authenticate. Ported
 * verbatim from backend/src/admin/whitelist.service.js including the
 * idempotent startup bootstrap that auto-seeds existing users on first enable.
 */
@Injectable()
export class WhitelistService {
  private readonly logger = new Logger(WhitelistService.name);

  constructor(
    @InjectModel(EmailWhitelist.name)
    private readonly whitelistModel: Model<EmailWhitelistDocument>,
    private readonly users: UsersService,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  isEnabled(): boolean {
    return this.configService.get('whitelist.enabled', { infer: true });
  }

  async isEmailAllowed(email: string | undefined | null): Promise<boolean> {
    if (!this.isEnabled()) return true;
    if (!email || typeof email !== 'string') return false;
    const normalized = email.toLowerCase().trim();
    const entry = await this.whitelistModel.findOne({ email: normalized }).lean();
    return !!entry;
  }

  async bootstrapFromExistingUsers(): Promise<{ seeded: number; skipped?: string }> {
    if (!this.isEnabled()) return { seeded: 0, skipped: 'whitelist_disabled' };

    const existingCount = await this.whitelistModel.estimatedDocumentCount();
    if (existingCount > 0) return { seeded: 0, skipped: 'already_populated' };

    const users = await this.users.getModel().find({}, { email: 1 }).lean();
    if (users.length === 0) return { seeded: 0, skipped: 'no_users' };

    const seen = new Set<string>();
    const docs: Array<{ email: string; addedBy: null; note: string }> = [];
    for (const u of users) {
      if (!u.email) continue;
      const norm = u.email.toLowerCase().trim();
      if (seen.has(norm)) continue;
      seen.add(norm);
      docs.push({ email: norm, addedBy: null, note: 'Auto-seeded on whitelist enable' });
    }

    if (docs.length === 0) return { seeded: 0, skipped: 'no_valid_emails' };

    await this.whitelistModel.insertMany(docs, { ordered: false });
    return { seeded: docs.length };
  }

  async runBootstrapAtStartup(): Promise<void> {
    try {
      const result = await this.bootstrapFromExistingUsers();
      if (result.seeded > 0) {
        this.logger.log(`Email whitelist bootstrap: seeded ${result.seeded} existing users`);
      }
    } catch (err) {
      this.logger.error(`Whitelist bootstrap failed: ${(err as Error).message}`);
    }
  }
}
