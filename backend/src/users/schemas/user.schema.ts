import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import * as crypto from 'crypto';
import { HydratedDocument, Model, Types } from 'mongoose';

import { getFileLimit, type SubscriptionType } from '../../common/constants/subscription';

export type UserDocument = HydratedDocument<User, IUserMethods>;
export type UserModel = Model<User, Record<string, never>, IUserMethods> &
  IUserStatics;

export type UserRole = 'user' | 'admin' | 'super_admin';

@Schema({ _id: false })
class NotificationPreferences {
  @Prop({ type: Boolean, default: true }) email!: boolean;
  @Prop({ type: Boolean, default: true }) browser!: boolean;
}
const NotificationPreferencesSchema = SchemaFactory.createForClass(NotificationPreferences);

@Schema({ _id: false })
class UserPreferences {
  @Prop({ type: String, enum: ['ru', 'uz', 'en'], default: 'ru' })
  language!: 'ru' | 'uz' | 'en';

  @Prop({ type: String, enum: ['light', 'dark', 'system'], default: 'system' })
  theme!: 'light' | 'dark' | 'system';

  @Prop({ type: String, default: null })
  defaultTemplate!: string | null;

  @Prop({ type: NotificationPreferencesSchema, default: () => ({}) })
  notifications!: NotificationPreferences;
}
const UserPreferencesSchema = SchemaFactory.createForClass(UserPreferences);

/**
 * Mongoose User schema - preserves every field, virtual, method and static
 * from the legacy backend/src/user/model.js, including the per-user JWT secret
 * rotation, TOTP fields, monthly counters, and Google profile sync.
 *
 * The `toJSON` transform strips sensitive fields so we don't accidentally leak
 * refresh secrets or TOTP secrets when serializing a user back to the client.
 */
@Schema({
  timestamps: true,
  toJSON: {
    transform: (_doc, ret: Record<string, unknown>) => {
      delete ret.__v;
      delete ret.refreshTokenSecret;
      delete ret.refreshTokenSecretCreatedAt;
      delete ret.totpSecret;
      delete ret.totpBackupCodes;
      return ret;
    },
  },
})
export class User {
  @Prop({ type: String, required: true, unique: true, index: true })
  googleId!: string;

  @Prop({ type: String, required: true, unique: true, lowercase: true, trim: true, index: true })
  email!: string;

  @Prop({ type: String, required: true, trim: true })
  name!: string;

  @Prop({ type: String, default: null })
  picture!: string | null;

  @Prop({
    type: String,
    enum: ['user', 'admin', 'super_admin'],
    default: 'user',
    index: true,
  })
  role!: UserRole;

  @Prop({
    type: String,
    enum: ['basic', 'premium'],
    default: 'basic',
  })
  subscriptionType!: SubscriptionType;

  @Prop({ type: Date, default: null })
  subscriptionExpiresAt!: Date | null;

  @Prop({ type: Number, default: 0, min: 0 })
  filesProcessedThisMonth!: number;

  @Prop({ type: Number, default: 0 })
  filesCompletedThisMonth!: number;

  @Prop({ type: Date, default: () => new Date() })
  monthlyResetDate!: Date;

  @Prop({ type: Boolean, default: true })
  isActive!: boolean;

  @Prop({ type: UserPreferencesSchema, default: () => ({}) })
  preferences!: UserPreferences;

  @Prop({ type: Date, default: Date.now })
  lastLoginAt!: Date;

  // Per-user JWT secret - never exposed.
  @Prop({ type: String, required: false, select: false })
  refreshTokenSecret?: string;

  @Prop({ type: Date, required: false })
  refreshTokenSecretCreatedAt?: Date;

  // ─── TOTP 2FA (admin only) ────────────────────────────────────────────
  @Prop({ type: String, required: false, select: false })
  totpSecret?: string;

  @Prop({ type: Boolean, default: false })
  totpEnabled!: boolean;

  @Prop({ type: Date, required: false })
  totpEnabledAt?: Date | null;

  @Prop({ type: [String], default: [], select: false })
  totpBackupCodes?: string[];
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index({ email: 1, isActive: 1 });
UserSchema.index({ subscriptionType: 1, isActive: 1 });

UserSchema.virtual('isSubscriptionActive').get(function (this: UserDocument) {
  if (this.subscriptionType === 'basic') return true;
  if (!this.subscriptionExpiresAt) return false;
  return this.subscriptionExpiresAt > new Date();
});

// ─── Instance methods ────────────────────────────────────────────────────────

export interface IUserMethods {
  canProcessFiles(): Promise<boolean>;
  incrementProcessedFiles(): Promise<UserDocument>;
  resetMonthlyCounterIfNeeded(): Promise<UserDocument>;
  updateLastLogin(): Promise<UserDocument>;
  generateRefreshTokenSecret(): string;
  needsSecretRegeneration(): boolean;
  regenerateRefreshTokenSecret(): Promise<UserDocument>;
  ensureRefreshTokenSecret(): Promise<UserDocument>;
  getRefreshTokenSecret(): Promise<string>;
}

UserSchema.methods.canProcessFiles = async function (this: UserDocument) {
  const limit = getFileLimit(this.subscriptionType);
  return this.filesProcessedThisMonth < limit && this.isActive;
};

UserSchema.methods.incrementProcessedFiles = function (this: UserDocument) {
  this.filesProcessedThisMonth += 1;
  return this.save();
};

UserSchema.methods.resetMonthlyCounterIfNeeded = function (this: UserDocument) {
  const now = new Date();
  const resetDate = new Date(this.monthlyResetDate);
  if (now.getTime() - resetDate.getTime() > 30 * 24 * 60 * 60 * 1000) {
    this.filesProcessedThisMonth = 0;
    this.filesCompletedThisMonth = 0;
    this.monthlyResetDate = now;
    return this.save();
  }
  return Promise.resolve(this);
};

UserSchema.methods.updateLastLogin = function (this: UserDocument) {
  this.lastLoginAt = new Date();
  return this.save();
};

UserSchema.methods.generateRefreshTokenSecret = function (): string {
  return crypto.randomBytes(32).toString('hex');
};

UserSchema.methods.needsSecretRegeneration = function (this: UserDocument): boolean {
  if (!this.refreshTokenSecret || !this.refreshTokenSecretCreatedAt) return true;
  const days =
    (Date.now() - new Date(this.refreshTokenSecretCreatedAt).getTime()) / (1000 * 60 * 60 * 24);
  return days >= 30;
};

UserSchema.methods.regenerateRefreshTokenSecret = async function (this: UserDocument) {
  this.refreshTokenSecret = (this as unknown as IUserMethods).generateRefreshTokenSecret();
  this.refreshTokenSecretCreatedAt = new Date();
  return this.save();
};

UserSchema.methods.ensureRefreshTokenSecret = async function (this: UserDocument) {
  if ((this as unknown as IUserMethods).needsSecretRegeneration()) {
    await (this as unknown as IUserMethods).regenerateRefreshTokenSecret();
  }
  return this;
};

UserSchema.methods.getRefreshTokenSecret = async function (this: UserDocument): Promise<string> {
  // If the secret wasn't selected on the original query, re-fetch with it loaded.
  if (!this.refreshTokenSecret) {
    const model = this.constructor as UserModel;
    const withSecret = await model
      .findById(this._id)
      .select('+refreshTokenSecret +refreshTokenSecretCreatedAt');
    if (!withSecret) throw new Error('User vanished while fetching refresh secret');
    if (!withSecret.refreshTokenSecret) {
      await (withSecret as unknown as IUserMethods).regenerateRefreshTokenSecret();
    }
    this.refreshTokenSecret = withSecret.refreshTokenSecret;
    this.refreshTokenSecretCreatedAt = withSecret.refreshTokenSecretCreatedAt;
  }

  if ((this as unknown as IUserMethods).needsSecretRegeneration()) {
    await (this as unknown as IUserMethods).regenerateRefreshTokenSecret();
  }

  return this.refreshTokenSecret!;
};

// ─── Statics ─────────────────────────────────────────────────────────────────

export interface GoogleProfileInput {
  id: string;
  emails?: Array<{ value?: string }>;
  displayName?: string;
  photos?: Array<{ value?: string }>;
}

export interface IUserStatics {
  findOrCreateFromGoogle(
    profile: GoogleProfileInput,
    options: { adminEmails: string[]; whitelistEnabled: boolean; isEmailAllowed: (e: string) => Promise<boolean> },
  ): Promise<UserDocument>;
}

// Mongoose's static typings narrow `this` to the base Model<User>; cast at the
// boundary so callers still get the rich UserModel shape.
const findOrCreateFromGoogleImpl = async function (
  this: UserModel,
  profile: GoogleProfileInput,
  {
    adminEmails,
    whitelistEnabled,
    isEmailAllowed,
  }: {
    adminEmails: string[];
    whitelistEnabled: boolean;
    isEmailAllowed: (email: string) => Promise<boolean>;
  },
): Promise<UserDocument> {
  const incomingEmail = profile.emails?.[0]?.value;

  // Whitelist gate - preserved from legacy logic, including super_admin failsafe.
  if (whitelistEnabled && incomingEmail) {
    const allowed = await isEmailAllowed(incomingEmail);
    if (!allowed) {
      const existing = await this.findOne({
        email: incomingEmail.toLowerCase().trim(),
      }).lean();
      const isExistingSuperAdmin = existing?.role === 'super_admin';
      if (!isExistingSuperAdmin) {
        const err = new Error('WHITELIST_BLOCKED') as Error & {
          code?: string;
          blockedEmail?: string;
        };
        err.code = 'WHITELIST_BLOCKED';
        err.blockedEmail = incomingEmail;
        throw err;
      }
    }
  }

  // Existing user path
  const existing = await this.findOne({ googleId: profile.id }).select(
    '+refreshTokenSecret +refreshTokenSecretCreatedAt',
  );

  if (existing) {
    existing.name = profile.displayName || existing.name;
    existing.email = profile.emails?.[0]?.value || existing.email;
    existing.picture = profile.photos?.[0]?.value || existing.picture;

    // Bootstrap super_admin from ADMIN_EMAILS (promote-only, never demote).
    if (existing.role === 'user' && adminEmails.includes(existing.email.toLowerCase())) {
      existing.role = 'super_admin';
    }

    await (existing as unknown as IUserMethods).updateLastLogin();
    await (existing as unknown as IUserMethods).ensureRefreshTokenSecret();
    return existing;
  }

  // New user path
  const newEmail = profile.emails?.[0]?.value;
  const initialRole: UserRole =
    newEmail && adminEmails.includes(newEmail.toLowerCase()) ? 'super_admin' : 'user';

  const created = new this({
    googleId: profile.id,
    email: newEmail,
    name: profile.displayName,
    picture: profile.photos?.[0]?.value,
    role: initialRole,
  });

  const methods = created as unknown as IUserMethods;
  created.refreshTokenSecret = methods.generateRefreshTokenSecret();
  created.refreshTokenSecretCreatedAt = new Date();

  await created.save();
  return created;
};

UserSchema.statics.findOrCreateFromGoogle =
  findOrCreateFromGoogleImpl as unknown as IUserStatics['findOrCreateFromGoogle'];

/** Helper to coerce raw ObjectId values to strings safely. */
export function asUserId(id: Types.ObjectId | string): string {
  return typeof id === 'string' ? id : id.toString();
}
