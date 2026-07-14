/**
 * src/integrations/orginfo/schemas/org-info-cache.schema.ts
 *
 * MongoDB cache of looked-up organization info, one row per INN. Org details
 * change rarely, so the service serves from here and only re-hits the provider
 * when a row is older than the configured TTL.
 */
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  HydratedDocument,
  Model,
  Schema as MongooseSchema,
} from 'mongoose';

import type { OrgInfo } from '../orginfo.types';

@Schema({ collection: 'org_info_cache', timestamps: true })
export class OrgInfoCache {
  @Prop({ type: String, required: true, unique: true, trim: true, index: true })
  inn!: string;

  /** The normalized OrgInfo payload. */
  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
  data!: OrgInfo;

  @Prop({ type: Date, default: () => new Date() })
  fetchedAt!: Date;
}

export type OrgInfoCacheDocument = HydratedDocument<OrgInfoCache>;
export const OrgInfoCacheSchema = SchemaFactory.createForClass(OrgInfoCache);
export type OrgInfoCacheModel = Model<OrgInfoCacheDocument>;
