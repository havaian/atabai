import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Model, Types } from 'mongoose';

export type ReportingPeriodKind =
  | 'opening'       // Zero-length anchor period at the transition date (architecture doc §7.3).
  | 'comparative'   // The year prior to reporting - needs full statements per IFRS 1.
  | 'reporting'     // The current period that triggered transition - full statements.
  | 'regular';      // Subsequent periods after first-time adoption.

export const REPORTING_PERIOD_KINDS: readonly ReportingPeriodKind[] = [
  'opening',
  'comparative',
  'reporting',
  'regular',
];

export type ReportingPeriodStatus = 'open' | 'locked';
export const REPORTING_PERIOD_STATUSES: readonly ReportingPeriodStatus[] = [
  'open',
  'locked',
];

export type ReportingPeriodDocument = HydratedDocument<ReportingPeriod>;
export type ReportingPeriodModel = Model<ReportingPeriod>;

/**
 * A keyed period dimension - architecture doc §7.3 calls this out as a "real
 * dimension from day one." Two snapshots (start/end) can't express opening +
 * comparative + reporting, and retrofitting periods after balances and
 * adjustments are stacked on top is exactly the rewrite-twice risk the doc
 * names in §9.
 *
 * Every AccountBalance, JournalEntry and Adjustment row is keyed by `periodId`.
 *
 * Opening periods are degenerate (startDate === endDate === transitionDate) -
 * modeled as same-day rather than as a distinct entity type so all the
 * period-keyed lookups stay uniform.
 *
 * Status is locked once the period is closed in IFRS terms - once locked, no
 * writes to NSBU_BASE / RECLASSIFICATION / ADJUSTMENT layers. Service-layer
 * rule, not schema-enforced (we still want admin/super_admin reopen paths).
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
export class ReportingPeriod {
  @Prop({
    type: Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true,
  })
  organizationId!: Types.ObjectId;

  @Prop({ type: String, enum: REPORTING_PERIOD_KINDS, required: true, index: true })
  kind!: ReportingPeriodKind;

  // Human-readable label, e.g. "Q1 2026" or "Opening - 01.01.2025".
  @Prop({ type: String, required: true, trim: true, maxlength: 100 })
  label!: string;

  @Prop({ type: Date, required: true, index: true })
  startDate!: Date;

  // For 'opening' periods, endDate === startDate (zero-length anchor).
  // For all others, endDate is exclusive of the next period's startDate
  // following accounting convention (Q1 = 01.01–31.03 inclusive).
  @Prop({ type: Date, required: true })
  endDate!: Date;

  @Prop({
    type: String,
    enum: REPORTING_PERIOD_STATUSES,
    required: true,
    default: 'open',
    index: true,
  })
  status!: ReportingPeriodStatus;

  // When status transitioned to 'locked' - null while open.
  @Prop({ type: Date, default: null })
  lockedAt!: Date | null;

  // Who locked it (admin user). Recorded for audit; the recovery flow requires
  // a super_admin to reopen, and that action is audited via logSecurity.
  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  lockedBy!: Types.ObjectId | null;
}

export const ReportingPeriodSchema = SchemaFactory.createForClass(ReportingPeriod);

// Hot lookups: an org's chronological period list, period-by-kind for the
// first-time-adoption seed check, range overlap for membership queries.
ReportingPeriodSchema.index({ organizationId: 1, startDate: 1 });
ReportingPeriodSchema.index({ organizationId: 1, kind: 1, startDate: -1 });
ReportingPeriodSchema.index({ organizationId: 1, status: 1, endDate: -1 });

// Same-org label uniqueness keeps the UI honest (no two "Q1 2026"s in one org).
ReportingPeriodSchema.index(
  { organizationId: 1, label: 1 },
  { unique: true },
);
