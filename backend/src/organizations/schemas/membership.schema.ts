import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Model, Types } from 'mongoose';

export type MembershipRole = 'admin' | 'member';
export type MembershipStatus = 'invited' | 'active' | 'revoked';

export const MEMBERSHIP_ROLES: readonly MembershipRole[] = ['admin', 'member'];
export const MEMBERSHIP_STATUSES: readonly MembershipStatus[] = ['invited', 'active', 'revoked'];

export type MembershipDocument = HydratedDocument<Membership>;
export type MembershipModel = Model<Membership>;

/**
 * The user ⋈ organization join carrying role, capabilities and lifecycle -
 * architecture doc §7.6.
 *
 * Either `userId` OR `invitedEmail` is set (never both null, never both set
 * for the same status). A pending invite to a not-yet-registered address
 * lives as `{ userId: null, invitedEmail: 'foo@x', status: 'invited' }`; on
 * the invitee's first login the service resolves it to `{ userId, invitedEmail: null }`
 * and (typically) flips status to 'active' once they accept.
 *
 * Authorization MUST resolve through OrgMembershipGuard - never inline
 * `org.createdBy.equals(user._id)` checks. That keeps the future Firm grantee
 * type additive (architecture doc §7.5).
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
export class Membership {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, index: true })
  organizationId!: Types.ObjectId;

  // Null while a pending email invite is unresolved.
  @Prop({ type: Types.ObjectId, ref: 'User', default: null, index: true })
  userId!: Types.ObjectId | null;

  // Set in tandem with userId:null. Cleared (set to null) when the invite resolves.
  @Prop({ type: String, default: null, lowercase: true, trim: true })
  invitedEmail!: string | null;

  @Prop({ type: String, enum: MEMBERSHIP_ROLES, required: true })
  role!: MembershipRole;

  // Growable set. The schema permits arbitrary strings so a new capability
  // can land without a migration; service code MUST gate on constants from
  // membership-capabilities.ts rather than literals.
  @Prop({ type: [String], default: [] })
  capabilities!: string[];

  @Prop({
    type: String,
    enum: MEMBERSHIP_STATUSES,
    required: true,
    default: 'invited',
    index: true,
  })
  status!: MembershipStatus;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  invitedBy!: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  invitedAt!: Date | null;

  @Prop({ type: Date, default: null })
  acceptedAt!: Date | null;

  @Prop({ type: Date, default: null })
  revokedAt!: Date | null;
}

export const MembershipSchema = SchemaFactory.createForClass(Membership);

// (org, user) uniqueness when the invite has been resolved to a real user.
MembershipSchema.index(
  { organizationId: 1, userId: 1 },
  {
    unique: true,
    partialFilterExpression: { userId: { $type: 'objectId' } },
  },
);

// (org, invited-email) uniqueness while the invite is unresolved - prevents
// double-inviting the same address.
MembershipSchema.index(
  { organizationId: 1, invitedEmail: 1 },
  {
    unique: true,
    partialFilterExpression: { invitedEmail: { $type: 'string' } },
  },
);

// Hot lookups: a user's active orgs, and an org's active member list.
MembershipSchema.index({ userId: 1, status: 1 });
MembershipSchema.index({ organizationId: 1, status: 1 });
MembershipSchema.index({ invitedEmail: 1, status: 1 });
