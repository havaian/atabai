import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type AdminSessionDocument = HydratedDocument<AdminSession>;

/**
 * Short-lived record proving an admin has passed TOTP verification.
 * Ported from backend/src/admin/models/adminSession.model.js - TTL index +
 * field names preserved exactly so the existing collection is reused.
 */
@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class AdminSession {
  @Prop({ type: String, required: true, unique: true, index: true })
  sessionId!: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ type: String, required: true })
  userEmail!: string;

  @Prop({ type: Date, required: true })
  expiresAt!: Date;

  @Prop({ type: String, default: null })
  ip!: string | null;

  @Prop({ type: String, default: null })
  userAgent!: string | null;

  @Prop({ type: String, enum: ['totp', 'backup_code'], required: true })
  method!: 'totp' | 'backup_code';
}

export const AdminSessionSchema = SchemaFactory.createForClass(AdminSession);

// TTL index - Mongo auto-deletes once expiresAt passes.
AdminSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
