import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Model, Types } from 'mongoose';

export type LocaleApp = 'user' | 'admin';
export type LocaleSource = 'file' | 'db';

export type LocaleKeyDocument = HydratedDocument<LocaleKey>;
export type LocaleKeyModel = Model<LocaleKey> & {
  deriveNamespace(key: string | null | undefined): string | null;
};

@Schema({ _id: false })
class LocaleValues {
  @Prop({ type: String, default: null }) ru!: string | null;
  @Prop({ type: String, default: null }) en!: string | null;
  @Prop({ type: String, default: null }) uz!: string | null;
}
const LocaleValuesSchema = SchemaFactory.createForClass(LocaleValues);

@Schema({ timestamps: true })
export class LocaleKey {
  @Prop({ type: String, required: true, unique: true, index: true, trim: true })
  key!: string;

  @Prop({ type: String, index: true, trim: true })
  namespace?: string;

  @Prop({ type: String, enum: ['user', 'admin'], required: true, index: true })
  app!: LocaleApp;

  @Prop({ type: LocaleValuesSchema, default: () => ({}) })
  values!: LocaleValues;

  @Prop({ type: String, enum: ['file', 'db'], default: 'file' })
  source!: LocaleSource;

  @Prop({ type: String, default: null, trim: true })
  notes!: string | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  updatedBy!: Types.ObjectId | null;
}

export const LocaleKeySchema = SchemaFactory.createForClass(LocaleKey);

LocaleKeySchema.index({ app: 1, namespace: 1, key: 1 });

LocaleKeySchema.statics.deriveNamespace = function (key: string | null | undefined): string | null {
  if (!key || typeof key !== 'string') return null;
  const dot = key.indexOf('.');
  return dot === -1 ? null : key.substring(0, dot);
};
