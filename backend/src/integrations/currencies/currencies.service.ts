/**
 * src/integrations/currencies/currencies.service.ts
 *
 * Public API of the Currencies integration. Cache-first: rates are served from
 * the currency_rates collection and only fetched from the CBU on a miss (or
 * when the current day's cached rate is older than the configured TTL).
 * Past-day rates are immutable and always served from cache.
 *
 * Conversion is deliberately NOT done here: the ledger keeps money in
 * Decimal128 and there is no decimal multiply/divide helper in this codebase
 * yet, so this module exposes `rate` + `nominal` (UZS per `nominal` units) and
 * leaves the actual multiplication to whichever ledger code wires it in - that
 * keeps floats out of the money path.
 */
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Types } from 'mongoose';

import { AppLoggerService } from '../../common/logger/app-logger.service';
import { CbuClient, type CbuRate } from './cbu.client';
import { loadCurrenciesConfig, type CurrenciesConfig } from './currencies.config';
import {
  CurrencyRate,
  type CurrencyRateDocument,
  type CurrencyRateModel,
} from './schemas/currency-rate.schema';

/** The national/base currency - CBU rates are all quoted as UZS per unit. */
const BASE_CURRENCY = 'UZS';

export interface RateInfo {
  ccy: string;
  date: string; // YYYY-MM-DD
  /** UZS per `nominal` units of `ccy`, as a decimal string (precision preserved). */
  rate: string;
  nominal: number;
  diff: string | null;
  nameEn: string | null;
  nameRu: string | null;
  fetchedAt: Date;
  /** True when served from cache without hitting the CBU on this call. */
  cached: boolean;
}

@Injectable()
export class CurrenciesService {
  private readonly config: CurrenciesConfig = loadCurrenciesConfig();

  constructor(
    @InjectModel(CurrencyRate.name)
    private readonly rateModel: CurrencyRateModel,
    private readonly cbu: CbuClient,
    private readonly logger: AppLoggerService,
  ) {}

  /**
   * Rate for one currency on a date (default: latest). Returns null when the
   * CBU has no rate for it and nothing is cached. The base currency (UZS)
   * resolves to a synthetic 1:1 rate without a network call.
   */
  async getRate(ccy: string, date?: string): Promise<RateInfo | null> {
    const code = ccy.toUpperCase().trim();
    const target = date ?? this.today();

    if (code === BASE_CURRENCY) {
      return {
        ccy: BASE_CURRENCY,
        date: target,
        rate: '1',
        nominal: 1,
        diff: null,
        nameEn: 'Uzbekistani Som',
        nameRu: 'Узбекский сум',
        fetchedAt: new Date(),
        cached: true,
      };
    }

    const existing = await this.rateModel.findOne({ ccy: code, date: target });
    if (existing && this.isUsable(existing, target)) {
      return this.toInfo(existing, true);
    }

    let fetched: CbuRate | null = null;
    try {
      fetched = await this.cbu.fetchOne(code, date);
    } catch {
      // Network/CBU error - fall back to any cached row, even if stale.
      if (existing) return this.toInfo(existing, true);
      return null;
    }

    if (!fetched) {
      if (existing) return this.toInfo(existing, true);
      return null;
    }

    const saved = await this.upsert(fetched);
    return this.toInfo(saved, false);
  }

  /**
   * All currencies for a date (default: latest published). Fetches + caches the
   * whole set when nothing is cached for that date.
   */
  async getRatesForDate(date?: string): Promise<RateInfo[]> {
    const target = date ?? this.today();
    const cached = await this.rateModel.find({ date: target }).sort({ ccy: 1 });
    if (cached.length > 0) {
      return cached.map((r) => this.toInfo(r, true));
    }

    let fetched: CbuRate[] = [];
    try {
      fetched = date ? await this.cbu.fetchForDate(date) : await this.cbu.fetchLatest();
    } catch {
      return [];
    }

    const saved = await Promise.all(fetched.map((r) => this.upsert(r)));
    return saved.map((r) => this.toInfo(r, false));
  }

  /**
   * Fetch the latest published set from the CBU and upsert it. Called by the
   * scheduled job and usable manually (e.g. an admin "refresh now" action).
   * Returns how many rows were written.
   */
  async refreshLatest(): Promise<{ fetched: number; date: string | null }> {
    const rows = await this.cbu.fetchLatest();
    await Promise.all(rows.map((r) => this.upsert(r)));
    const date = rows[0]?.date ?? null;
    this.logger.info(
      'Currencies refreshed from CBU',
      { count: rows.length, date },
      'CurrenciesService',
    );
    return { fetched: rows.length, date };
  }

  // ─── Internal ─────────────────────────────────────────────────────────────

  private async upsert(rate: CbuRate): Promise<CurrencyRateDocument> {
    const doc = await this.rateModel.findOneAndUpdate(
      { ccy: rate.ccy, date: rate.date },
      {
        $set: {
          rate: Types.Decimal128.fromString(rate.rate),
          nominal: rate.nominal,
          diff: rate.diff,
          nameEn: rate.nameEn,
          nameRu: rate.nameRu,
          source: 'cbu',
          fetchedAt: new Date(),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    // findOneAndUpdate with upsert+new always returns the document.
    return doc as CurrencyRateDocument;
  }

  private isUsable(row: CurrencyRateDocument, target: string): boolean {
    // Past-day rates never change → always usable.
    if (target < this.today()) return true;
    // Current-day rate is usable until the TTL lapses (then we try a refetch).
    const ageMs = Date.now() - row.fetchedAt.getTime();
    return ageMs < this.config.cacheTtlHours * 60 * 60 * 1000;
  }

  private toInfo(row: CurrencyRateDocument, cached: boolean): RateInfo {
    return {
      ccy: row.ccy,
      date: row.date,
      rate: row.rate.toString(),
      nominal: row.nominal,
      diff: row.diff,
      nameEn: row.nameEn,
      nameRu: row.nameRu,
      fetchedAt: row.fetchedAt,
      cached,
    };
  }

  /** Today as 'YYYY-MM-DD' in the configured timezone (en-CA yields ISO order). */
  private today(): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: this.config.cronTimezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  }
}
