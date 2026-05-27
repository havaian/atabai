import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Model, Types } from 'mongoose';

export type OrganizationDocument = HydratedDocument<Organization>;
export type OrganizationModel = Model<Organization>;

/**
 * Tenant entity for the access spine (architecture doc §7.6).
 *
 * An Organization cannot exist without an admin Membership row — that
 * invariant lives in the service layer (creation always pairs the org with
 * a Membership), not in the schema. The `createdBy` field is informational
 * only: ownership is carried on Membership.role === 'admin', and an org may
 * have its primary admin transferred without changing `createdBy`.
 *
 * Org requisites (settlement accounts, bank codes) deliberately do NOT live
 * here — they belong to the ledger spine and attach to a sibling entity to
 * avoid scope creep. See architecture doc §8.1.
 */
@Schema({
  timestamps: true,
  toJSON: {
    transform: (_doc, ret: Record<string, unknown>) => {
      delete ret.__v;
      return ret;
    },
  },
})
export class Organization {
  @Prop({ type: String, required: true, trim: true, maxlength: 255 })
  name!: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  createdBy!: Types.ObjectId;

  @Prop({ type: Boolean, default: true, index: true })
  isActive!: boolean;
}

export const OrganizationSchema = SchemaFactory.createForClass(Organization);

OrganizationSchema.index({ name: 1 });
OrganizationSchema.index({ createdBy: 1, isActive: 1 });
