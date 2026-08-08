/**
 * src/integrations/currencies/schemas/currency-rate.schema.ts
 *
 * MongoDB cache of CBU exchange rates, one row per (currency, date) - the
 * caching-per-currency/date-pair strategy the methodology recommends. Rates are
 * quoted by the CBU as UZS per `nominal` units of the currency. Money is
 * Decimal128 like everywhere else in the ledger; no floats.
 */
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  HydratedDocument,
  Model,
  Schema as MongooseSchema,
  Types,
} from 'mongoose';

@Schema({ collection: 'currency_rates', timestamps: true })
export class CurrencyRate {
  /** ISO 4217 alphabetic code, upper-case (e.g. USD, EUR, RUB). */
  @Prop({ type: String, required: true, uppercase: true, trim: true, index: true })
  ccy!: string;

  /** The rate date as 'YYYY-MM-DD' (the CBU publishes one set of rates per day). */
  @Prop({ type: String, required: true, trim: true, index: true })
  date!: string;

  /** UZS per `nominal` units of `ccy`. */
  @Prop({ type: MongooseSchema.Types.Decimal128, required: true })
  rate!: Types.Decimal128;

  /** Units the rate is quoted for (usually 1; some currencies quote per 10/100/1000). */
  @Prop({ type: Number, default: 1 })
  nominal!: number;

  /** Day-over-day change as reported by the CBU (string, may be signed). Informational. */
  @Prop({ type: String, default: null })
  diff!: string | null;

  /** English currency name from the CBU payload (informational). */
  @Prop({ type: String, default: null })
  nameEn!: string | null;

  /** Russian currency name from the CBU payload (informational). */
  @Prop({ type: String, default: null })
  nameRu!: string | null;

  /** Where the row came from - always 'cbu' for now, kept for future providers. */
  @Prop({ type: String, default: 'cbu' })
  source!: string;

  /** When this row was fetched/refreshed from the provider. */
  @Prop({ type: Date, default: () => new Date() })
  fetchedAt!: Date;
}

export type CurrencyRateDocument = HydratedDocument<CurrencyRate>;
export const CurrencyRateSchema = SchemaFactory.createForClass(CurrencyRate);
export type CurrencyRateModel = Model<CurrencyRateDocument>;

// One rate per currency per day.
CurrencyRateSchema.index({ ccy: 1, date: 1 }, { unique: true, name: 'ccy_date' });
