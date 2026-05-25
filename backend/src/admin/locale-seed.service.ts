import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as fs from 'fs';
import * as path from 'path';

import { LocaleKey, type LocaleKeyModel } from './schemas/locale-key.schema';

const SEED_DIR = path.join(__dirname, 'seedLocales');

export interface SeedAppResult {
  inserted: number;
  total: number;
}

/**
 * Ported from backend/src/admin/localeSeed.js.
 *
 * Flattens nested JSON locale files, then bulk-inserts missing keys. DB is
 * authoritative after first bootstrap — existing keys are never overwritten.
 */
@Injectable()
export class LocaleSeedService {
  private readonly logger = new Logger(LocaleSeedService.name);

  constructor(@InjectModel(LocaleKey.name) private readonly localeModel: LocaleKeyModel) {}

  flatten(obj: unknown, prefix = ''): Record<string, string> {
    const out: Record<string, string> = {};
    if (!obj || typeof obj !== 'object') return out;
    for (const k of Object.keys(obj as Record<string, unknown>)) {
      const v = (obj as Record<string, unknown>)[k];
      const fullKey = prefix ? `${prefix}.${k}` : k;
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        Object.assign(out, this.flatten(v, fullKey));
      } else if (typeof v === 'string') {
        out[fullKey] = v;
      }
    }
    return out;
  }

  readLocaleFile(filename: string): Record<string, string> {
    const filePath = path.join(SEED_DIR, filename);
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      return this.flatten(JSON.parse(raw));
    } catch (err) {
      this.logger.error(`Failed to read seed locale file "${filename}": ${(err as Error).message}`);
      return {};
    }
  }

  async seedApp(app: 'user' | 'admin'): Promise<SeedAppResult> {
    const prefix = app === 'admin' ? 'admin-' : '';
    const ruMap = this.readLocaleFile(`${prefix}ru.json`);
    const enMap = this.readLocaleFile(`${prefix}en.json`);
    const uzMap = this.readLocaleFile(`${prefix}uz.json`);

    const allKeys = new Set([...Object.keys(ruMap), ...Object.keys(enMap), ...Object.keys(uzMap)]);
    if (allKeys.size === 0) return { inserted: 0, total: 0 };

    const existing = await this.localeModel
      .find({ app, key: { $in: Array.from(allKeys) } })
      .select('key')
      .lean();
    const existingSet = new Set(existing.map((d) => d.key));

    const toInsert: Array<{
      key: string;
      namespace: string | null;
      app: 'user' | 'admin';
      values: { ru: string | null; en: string | null; uz: string | null };
      source: 'file';
    }> = [];
    for (const key of allKeys) {
      if (existingSet.has(key)) continue;
      toInsert.push({
        key,
        namespace: this.localeModel.deriveNamespace(key),
        app,
        values: {
          ru: ruMap[key] ?? null,
          en: enMap[key] ?? null,
          uz: uzMap[key] ?? null,
        },
        source: 'file',
      });
    }

    if (toInsert.length === 0) return { inserted: 0, total: allKeys.size };

    try {
      await this.localeModel.insertMany(toInsert, { ordered: false });
    } catch (err) {
      const e = err as { code?: number; writeErrors?: unknown[] };
      if (e.code !== 11000 && e.writeErrors) {
        this.logger.error(`Locale seed insert errors: ${e.writeErrors.length}`);
      }
    }

    return { inserted: toInsert.length, total: allKeys.size };
  }

  async runSeed(): Promise<{ user: SeedAppResult; admin: SeedAppResult }> {
    const user = await this.seedApp('user');
    const admin = await this.seedApp('admin');
    return { user, admin };
  }

  async runSeedAtStartup(): Promise<void> {
    try {
      const results = await this.runSeed();
      const parts: string[] = [];
      if (results.user.inserted > 0) parts.push(`user: ${results.user.inserted}/${results.user.total} new`);
      if (results.admin.inserted > 0)
        parts.push(`admin: ${results.admin.inserted}/${results.admin.total} new`);
      if (parts.length > 0) this.logger.log(`Locale seed inserted keys — ${parts.join(', ')}`);
    } catch (err) {
      this.logger.error(`Locale seed at startup failed: ${(err as Error).message}`);
    }
  }
}
