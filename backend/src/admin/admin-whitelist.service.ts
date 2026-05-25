import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import {
  EmailWhitelist,
  type EmailWhitelistDocument,
} from '../auth/schemas/email-whitelist.schema';
import { WhitelistService } from '../auth/whitelist.service';
import { AppLoggerService } from '../common/logger/app-logger.service';

export interface BulkResult {
  added: number;
  skipped: number;
  message?: string;
}

/**
 * CRUD on the EmailWhitelist collection. Read concerns (is email allowed,
 * bootstrap from existing users) stay on the auth-side WhitelistService; this
 * service owns the admin mutations.
 */
@Injectable()
export class AdminWhitelistService {
  constructor(
    @InjectModel(EmailWhitelist.name)
    private readonly whitelistModel: Model<EmailWhitelistDocument>,
    private readonly whitelist: WhitelistService,
    private readonly logger: AppLoggerService,
  ) {}

  async list() {
    const entries = await this.whitelistModel
      .find({})
      .populate('addedBy', 'email name')
      .sort({ createdAt: -1 })
      .lean();
    return { success: true, enabled: this.whitelist.isEnabled(), entries };
  }

  async addEntry(adminUserId: Types.ObjectId, email: string, note?: string) {
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      throw new BadRequestException({ error: 'INVALID_EMAIL', message: 'Valid email required' });
    }
    const normalized = email.toLowerCase().trim();
    const existing = await this.whitelistModel.findOne({ email: normalized });
    if (existing) {
      throw new ConflictException({ error: 'DUPLICATE', message: 'Email already in whitelist' });
    }
    const entry = await this.whitelistModel.create({
      email: normalized,
      addedBy: adminUserId,
      note: typeof note === 'string' ? note.trim() : '',
    });
    this.logger.logSecurity(
      'Email added to whitelist',
      { adminId: adminUserId.toString(), email: normalized },
      'info',
    );
    return { success: true, entry };
  }

  async bulkAdd(
    adminUserId: Types.ObjectId,
    emails: string[],
    note?: string,
  ): Promise<{ success: true } & BulkResult> {
    if (!Array.isArray(emails) || emails.length === 0) {
      throw new BadRequestException({ error: 'INVALID_EMAILS', message: 'emails array required' });
    }

    const seen = new Set<string>();
    const docs: Array<{ email: string; addedBy: Types.ObjectId; note: string }> = [];
    for (const raw of emails) {
      if (typeof raw !== 'string') continue;
      const norm = raw.toLowerCase().trim();
      if (!norm || !norm.includes('@') || seen.has(norm)) continue;
      seen.add(norm);
      docs.push({
        email: norm,
        addedBy: adminUserId,
        note: typeof note === 'string' ? note.trim() : '',
      });
    }

    if (docs.length === 0) {
      return { success: true, added: 0, skipped: emails.length, message: 'No valid emails' };
    }

    let added = 0;
    try {
      const result = await this.whitelistModel.insertMany(docs, { ordered: false });
      added = result.length;
    } catch (bulkErr) {
      const e = bulkErr as {
        result?: { insertedCount?: number };
        insertedDocs?: unknown[];
      };
      if (e.result && typeof e.result.insertedCount === 'number') added = e.result.insertedCount;
      else if (Array.isArray(e.insertedDocs)) added = e.insertedDocs.length;
    }

    this.logger.logSecurity(
      'Bulk whitelist add',
      { adminId: adminUserId.toString(), attempted: docs.length, added },
      'info',
    );

    return { success: true, added, skipped: docs.length - added };
  }

  async removeEntry(adminUserId: Types.ObjectId, entryId: string) {
    const entry = await this.whitelistModel.findById(entryId);
    if (!entry) throw new NotFoundException({ error: 'NOT_FOUND', message: 'Entry not found' });
    const snapshot = entry.email;
    await entry.deleteOne();
    this.logger.logSecurity(
      'Email removed from whitelist',
      { adminId: adminUserId.toString(), email: snapshot },
      'info',
    );
    return { success: true };
  }
}
