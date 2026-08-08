import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type EmailWhitelistDocument = HydratedDocument<EmailWhitelist>;

/**
 * Explicit allowlist of emails permitted to sign in. Active only when
 * ENABLE_EMAIL_WHITELIST=true. Ported from
 * backend/src/admin/models/emailWhitelist.model.js - collection/field shape
 * preserved.
 */
@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class EmailWhitelist {
  @Prop({
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true,
  })
  email!: string;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  addedBy!: Types.ObjectId | null;

  @Prop({ type: String, default: '' })
  note!: string;
}

export const EmailWhitelistSchema = SchemaFactory.createForClass(EmailWhitelist);
