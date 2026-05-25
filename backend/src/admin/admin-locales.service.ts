import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Types } from 'mongoose';

import { AppLoggerService } from '../common/logger/app-logger.service';
import { LocaleBundleService, ALLOWED_LANGS, AllowedLang } from './locale-bundle.service';
import { LocaleSeedService } from './locale-seed.service';
import {
  LocaleKey,
  type LocaleApp,
  type LocaleKeyDocument,
  type LocaleKeyModel,
} from './schemas/locale-key.schema';

interface ListKeysOptions {
  app?: string;
  namespace?: string;
  q?: string;
  missing?: string;
  page?: number;
  limit?: number;
}

const ALLOWED_APPS: LocaleApp[] = ['user', 'admin'];

@Injectable()
export class AdminLocalesService {
  constructor(
    @InjectModel(LocaleKey.name) private readonly localeModel: LocaleKeyModel,
    private readonly bundle: LocaleBundleService,
    private readonly seed: LocaleSeedService,
    private readonly logger: AppLoggerService,
  ) {}

  async listKeys(opts: ListKeysOptions) {
    const page = Math.max(1, Number(opts.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(opts.limit) || 50));

    const filter: FilterQuery<LocaleKeyDocument> = {};
    if (opts.app && ALLOWED_APPS.includes(opts.app as LocaleApp)) {
      filter.app = opts.app;
    }
    if (opts.namespace) filter.namespace = opts.namespace;

    if (opts.missing && (ALLOWED_LANGS as readonly string[]).includes(opts.missing)) {
      filter.$or = [
        { [`values.${opts.missing}`]: null },
        { [`values.${opts.missing}`]: '' },
        { [`values.${opts.missing}`]: { $exists: false } },
      ];
    }
    if (opts.q) {
      const safe = String(opts.q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rx = new RegExp(safe, 'i');
      const search = [{ key: rx }, { 'values.ru': rx }, { 'values.en': rx }, { 'values.uz': rx }];
      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, { $or: search }];
        delete filter.$or;
      } else {
        filter.$or = search;
      }
    }

    const total = await this.localeModel.countDocuments(filter);
    const keys = await this.localeModel
      .find(filter)
      .sort({ app: 1, key: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('updatedBy', 'email name')
      .lean();

    return {
      success: true,
      keys,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
    };
  }

  async listNamespaces() {
    const [userNs, adminNs] = await Promise.all([
      this.localeModel.distinct('namespace', { app: 'user' }),
      this.localeModel.distinct('namespace', { app: 'admin' }),
    ]);
    return {
      success: true,
      user: (userNs as Array<string | null>).filter((n): n is string => !!n).sort(),
      admin: (adminNs as Array<string | null>).filter((n): n is string => !!n).sort(),
    };
  }

  async getStats() {
    const stats: Record<LocaleApp, { total: number; missing: Record<AllowedLang, number> }> = {
      user: { total: 0, missing: { ru: 0, en: 0, uz: 0 } },
      admin: { total: 0, missing: { ru: 0, en: 0, uz: 0 } },
    };
    for (const app of ALLOWED_APPS) {
      stats[app].total = await this.localeModel.countDocuments({ app });
      for (const lang of ALLOWED_LANGS) {
        stats[app].missing[lang] = await this.localeModel.countDocuments({
          app,
          $or: [
            { [`values.${lang}`]: null },
            { [`values.${lang}`]: '' },
            { [`values.${lang}`]: { $exists: false } },
          ],
        });
      }
    }
    return { success: true, stats };
  }

  async createKey(
    adminUserId: Types.ObjectId,
    payload: {
      key?: string;
      app?: string;
      values?: { ru?: string | null; en?: string | null; uz?: string | null };
      notes?: string;
    },
  ) {
    if (!payload.key || typeof payload.key !== 'string' || !payload.key.trim()) {
      throw new BadRequestException({ error: 'INVALID_KEY', message: 'Key is required' });
    }
    if (!payload.app || !ALLOWED_APPS.includes(payload.app as LocaleApp)) {
      throw new BadRequestException({ error: 'INVALID_APP', message: 'App must be user or admin' });
    }

    const trimmedKey = payload.key.trim();
    const existing = await this.localeModel.findOne({ key: trimmedKey });
    if (existing) {
      throw new ConflictException({ error: 'DUPLICATE_KEY', message: 'Key already exists' });
    }

    const built = {
      ru: payload.values?.ru ? String(payload.values.ru) : null,
      en: payload.values?.en ? String(payload.values.en) : null,
      uz: payload.values?.uz ? String(payload.values.uz) : null,
    };

    const doc = await this.localeModel.create({
      key: trimmedKey,
      namespace: this.localeModel.deriveNamespace(trimmedKey),
      app: payload.app as LocaleApp,
      values: built,
      notes: typeof payload.notes === 'string' ? payload.notes.trim() || null : null,
      source: 'db',
      updatedBy: adminUserId,
    });

    this.bundle.bumpVersion(payload.app as LocaleApp);
    this.logger.logSecurity('Locale key created', {
      adminId: adminUserId.toString(),
      keyId: doc._id.toString(),
      key: doc.key,
      app: doc.app,
    });

    return { success: true, key: doc };
  }

  async updateKey(
    adminUserId: Types.ObjectId,
    keyId: string,
    payload: {
      values?: { ru?: string | null; en?: string | null; uz?: string | null };
      notes?: string;
    },
  ) {
    const doc = await this.localeModel.findById(keyId);
    if (!doc) throw new NotFoundException({ error: 'NOT_FOUND', message: 'Locale key not found' });

    if (payload.values && typeof payload.values === 'object') {
      for (const lang of ALLOWED_LANGS) {
        if (Object.prototype.hasOwnProperty.call(payload.values, lang)) {
          const v = payload.values[lang];
          doc.values[lang] = v === null || v === '' ? null : String(v);
        }
      }
    }
    if (typeof payload.notes === 'string') {
      doc.notes = payload.notes.trim() || null;
    }
    doc.source = 'db';
    doc.updatedBy = adminUserId;
    await doc.save();

    this.bundle.bumpVersion(doc.app);
    this.logger.logSecurity('Locale key updated', {
      adminId: adminUserId.toString(),
      keyId,
      key: doc.key,
      app: doc.app,
    });

    return { success: true, key: doc };
  }

  async deleteKey(adminUserId: Types.ObjectId, keyId: string) {
    const doc = await this.localeModel.findById(keyId);
    if (!doc) throw new NotFoundException({ error: 'NOT_FOUND', message: 'Locale key not found' });

    const snapshot = { key: doc.key, app: doc.app };
    await doc.deleteOne();
    this.bundle.bumpVersion(snapshot.app);
    this.logger.logSecurity('Locale key deleted', {
      adminId: adminUserId.toString(),
      keyId,
      key: snapshot.key,
      app: snapshot.app,
    });
    return { success: true };
  }

  async manualSeed(adminUserId: Types.ObjectId) {
    const results = await this.seed.runSeed();
    this.bundle.bumpVersion('user');
    this.bundle.bumpVersion('admin');
    this.logger.logSecurity('Locale seed run manually', {
      adminId: adminUserId.toString(),
      results,
    });
    return { success: true, results };
  }
}
