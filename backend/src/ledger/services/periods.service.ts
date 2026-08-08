import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Types, isValidObjectId } from 'mongoose';

import { AppLoggerService } from '../../common/logger/app-logger.service';
import type { UserDocument } from '../../users/schemas/user.schema';
import {
  ReportingPeriod,
  type ReportingPeriodDocument,
  type ReportingPeriodKind,
  type ReportingPeriodModel,
} from '../schemas/reporting-period.schema';

export interface CreateTransitionPeriodsArgs {
  organizationId: Types.ObjectId | string;
  /**
   * The boundary day for first-time IFRS adoption. Per methodology §1: if the
   * first reporting year is 2026, this is 01.01.2025 (the start of the
   * comparative year - equivalently the "Входящий баланс на 01.01.2025 / на
   * 31.12.2024" point in time).
   */
  transitionDate: Date;
  /**
   * The first FULL reporting year (the calendar year for which a complete
   * IFRS statement set will be filed). Drives both the comparative year and
   * the reporting period date ranges. e.g. firstReportingYear = 2026 →
   * comparative covers 2025-01-01 .. 2025-12-31, reporting covers 2026.
   */
  firstReportingYear: number;
  /** User initiating the bootstrap - audit trail only. */
  actor: UserDocument;
}

export interface CreateRegularPeriodArgs {
  organizationId: Types.ObjectId | string;
  label: string;
  startDate: Date;
  endDate: Date;
  actor: UserDocument;
}

/**
 * Manages ReportingPeriod lifecycle - architecture doc §7.3.
 *
 * Three things this service guarantees that downstream services rely on:
 *   1. First-time-adoption seeds exactly three periods (opening, comparative,
 *      reporting) atomically - partial state never reaches the database.
 *   2. `assertWritable(periodId)` throws on locked or missing periods. The
 *      bank engine, ОСВ ingestion and adjustment engine all call this before
 *      mutating balances/journal entries in a period's scope.
 *   3. Reopen is `super_admin`-only and audited via `logSecurity`. The doc
 *      §7.5 recovery-not-backdoor rule applies here: a regular admin closing
 *      a period is normal; reopening it is not.
 *
 * Authorization (admin/super_admin checks against the access spine) lives in
 * the controller - this service trusts its caller. The audit metadata
 * (`actor`) is for the log, not enforcement.
 */
@Injectable()
export class PeriodsService {
  constructor(
    @InjectModel(ReportingPeriod.name)
    private readonly periodModel: ReportingPeriodModel,
    private readonly logger: AppLoggerService,
  ) {}

  /**
   * Seed the three first-time-adoption periods. Rejects if an `opening`
   * period already exists for the org - re-running this would be the kind
   * of action that quietly destroys ledger state and should never be
   * allowed to succeed accidentally. To redo first-time adoption, the
   * operator must explicitly delete the existing periods (no API for that
   * yet on purpose).
   */
  async createTransitionPeriods(
    args: CreateTransitionPeriodsArgs,
  ): Promise<ReportingPeriodDocument[]> {
    const orgId = this.asObjectId(args.organizationId);

    const existingOpening = await this.periodModel.findOne({
      organizationId: orgId,
      kind: 'opening',
    });
    if (existingOpening) {
      throw new ConflictException({
        error: 'TRANSITION_ALREADY_SEEDED',
        message:
          'This organization already has an opening period - first-time adoption can only be run once',
      });
    }

    const { transitionDate, firstReportingYear } = args;
    if (!Number.isInteger(firstReportingYear) || firstReportingYear < 1900) {
      throw new BadRequestException({
        error: 'INVALID_REPORTING_YEAR',
        message: 'firstReportingYear must be a valid 4-digit calendar year',
      });
    }
    if (!(transitionDate instanceof Date) || Number.isNaN(transitionDate.getTime())) {
      throw new BadRequestException({
        error: 'INVALID_TRANSITION_DATE',
        message: 'transitionDate must be a valid Date',
      });
    }

    const comparativeYear = firstReportingYear - 1;
    // UTC dates throughout - operator-facing labels use the calendar-year
    // ambiguity-free `FY YYYY` form rather than time-zone-sensitive ISO strings.
    const startOfYear = (year: number): Date =>
      new Date(Date.UTC(year, 0, 1));
    const endOfYear = (year: number): Date =>
      new Date(Date.UTC(year, 11, 31));

    const docs = [
      {
        organizationId: orgId,
        kind: 'opening' as ReportingPeriodKind,
        label: `Opening - ${this.formatDmy(transitionDate)}`,
        startDate: transitionDate,
        endDate: transitionDate,
        status: 'open' as const,
      },
      {
        organizationId: orgId,
        kind: 'comparative' as ReportingPeriodKind,
        label: `FY ${comparativeYear} (comparative)`,
        startDate: startOfYear(comparativeYear),
        endDate: endOfYear(comparativeYear),
        status: 'open' as const,
      },
      {
        organizationId: orgId,
        kind: 'reporting' as ReportingPeriodKind,
        label: `FY ${firstReportingYear}`,
        startDate: startOfYear(firstReportingYear),
        endDate: endOfYear(firstReportingYear),
        status: 'open' as const,
      },
    ];

    let created: ReportingPeriodDocument[];
    try {
      created = await this.periodModel.create(docs);
    } catch (err) {
      // E11000 on the (org, label) unique index - leaks if a prior partial
      // run created some but not all. Surface a clearer error.
      const e = err as { code?: number; message?: string };
      if (e.code === 11000) {
        throw new ConflictException({
          error: 'PERIOD_LABEL_COLLISION',
          message:
            'One of the auto-generated period labels collides with an existing period. Resolve manually before re-running.',
        });
      }
      throw err;
    }

    this.logger.logAction('ledger.periods.transition_seeded', {
      orgId: orgId.toString(),
      transitionDate: transitionDate.toISOString(),
      firstReportingYear,
      comparativeYear,
      periodIds: created.map((p) => p._id.toString()),
      actor: args.actor._id.toString(),
    });

    return created;
  }

  async createRegularPeriod(
    args: CreateRegularPeriodArgs,
  ): Promise<ReportingPeriodDocument> {
    const orgId = this.asObjectId(args.organizationId);

    if (!(args.startDate instanceof Date) || Number.isNaN(args.startDate.getTime())) {
      throw new BadRequestException({
        error: 'INVALID_START_DATE',
        message: 'startDate must be a valid Date',
      });
    }
    if (!(args.endDate instanceof Date) || Number.isNaN(args.endDate.getTime())) {
      throw new BadRequestException({
        error: 'INVALID_END_DATE',
        message: 'endDate must be a valid Date',
      });
    }
    if (args.endDate.getTime() < args.startDate.getTime()) {
      throw new BadRequestException({
        error: 'INVALID_DATE_RANGE',
        message: 'endDate must be on or after startDate',
      });
    }
    if (!args.label || args.label.trim().length === 0) {
      throw new BadRequestException({
        error: 'INVALID_LABEL',
        message: 'label is required',
      });
    }

    let created: ReportingPeriodDocument;
    try {
      created = await this.periodModel.create({
        organizationId: orgId,
        kind: 'regular',
        label: args.label.trim(),
        startDate: args.startDate,
        endDate: args.endDate,
        status: 'open',
      });
    } catch (err) {
      const e = err as { code?: number };
      if (e.code === 11000) {
        throw new ConflictException({
          error: 'PERIOD_LABEL_DUPLICATE',
          message: 'A period with this label already exists in the organization',
        });
      }
      throw err;
    }

    this.logger.logAction('ledger.periods.created', {
      orgId: orgId.toString(),
      periodId: created._id.toString(),
      label: created.label,
      actor: args.actor._id.toString(),
    });

    return created;
  }

  // ─── Lock / reopen ──────────────────────────────────────────────────────────

  async lockPeriod(
    orgId: Types.ObjectId | string,
    periodId: string,
    actor: UserDocument,
  ): Promise<ReportingPeriodDocument> {
    const period = await this.requirePeriod(orgId, periodId);
    if (period.status === 'locked') {
      throw new ConflictException({
        error: 'PERIOD_ALREADY_LOCKED',
        message: 'Period is already locked',
      });
    }
    period.status = 'locked';
    period.lockedAt = new Date();
    period.lockedBy = actor._id;
    await period.save();

    this.logger.logAction('ledger.periods.locked', {
      orgId: period.organizationId.toString(),
      periodId: period._id.toString(),
      label: period.label,
      actor: actor._id.toString(),
    });

    return period;
  }

  /**
   * Reopen is super_admin-only. Service trusts the caller to have enforced
   * that (controller layer) but logs the action via `logSecurity` regardless
   * - the doc §7.5 recovery-not-backdoor rule means every reopen is audited.
   */
  async reopenPeriod(
    orgId: Types.ObjectId | string,
    periodId: string,
    actor: UserDocument,
  ): Promise<ReportingPeriodDocument> {
    if (actor.role !== 'super_admin') {
      // Defence-in-depth: even if the controller forgot to gate, reject here.
      throw new ForbiddenException({
        error: 'REOPEN_REQUIRES_SUPER_ADMIN',
        message: 'Only platform super admins can reopen a locked period',
      });
    }

    const period = await this.requirePeriod(orgId, periodId);
    if (period.status === 'open') {
      throw new ConflictException({
        error: 'PERIOD_ALREADY_OPEN',
        message: 'Period is not locked',
      });
    }

    const wasLockedBy = period.lockedBy?.toString() ?? null;
    const wasLockedAt = period.lockedAt;

    period.status = 'open';
    period.lockedAt = null;
    period.lockedBy = null;
    await period.save();

    this.logger.logSecurity(
      'period reopen by super_admin',
      {
        orgId: period.organizationId.toString(),
        periodId: period._id.toString(),
        label: period.label,
        actor: actor._id.toString(),
        wasLockedBy,
        wasLockedAt: wasLockedAt?.toISOString() ?? null,
      },
      'warn',
    );

    return period;
  }

  // ─── Read helpers ──────────────────────────────────────────────────────────

  async listPeriods(
    orgId: Types.ObjectId | string,
  ): Promise<ReportingPeriodDocument[]> {
    return this.periodModel
      .find({ organizationId: this.asObjectId(orgId) })
      .sort({ startDate: 1 });
  }

  async getPeriod(
    orgId: Types.ObjectId | string,
    periodId: string,
  ): Promise<ReportingPeriodDocument> {
    return this.requirePeriod(orgId, periodId);
  }

  /**
   * Throws unless the period exists in the org AND is open. Called by the
   * bank engine / OSV ingestion / adjustment engine before any write that
   * would land balances or journal entries in this period's scope.
   *
   * Returns the period document on success so callers can avoid a second
   * fetch right after the check.
   */
  async assertWritable(
    orgId: Types.ObjectId | string,
    periodId: Types.ObjectId | string,
  ): Promise<ReportingPeriodDocument> {
    const period = await this.requirePeriod(orgId, periodId);
    if (period.status === 'locked') {
      throw new ForbiddenException({
        error: 'PERIOD_LOCKED',
        message: `Period "${period.label}" is locked and cannot accept writes`,
      });
    }
    return period;
  }

  // ─── Internal ──────────────────────────────────────────────────────────────

  private async requirePeriod(
    orgId: Types.ObjectId | string,
    periodId: Types.ObjectId | string,
  ): Promise<ReportingPeriodDocument> {
    const periodIdStr =
      typeof periodId === 'string' ? periodId : periodId.toString();
    if (!isValidObjectId(periodIdStr)) {
      throw new NotFoundException({
        error: 'PERIOD_NOT_FOUND',
        message: 'Reporting period not found',
      });
    }
    const period = await this.periodModel.findOne({
      _id: new Types.ObjectId(periodIdStr),
      organizationId: this.asObjectId(orgId),
    });
    if (!period) {
      throw new NotFoundException({
        error: 'PERIOD_NOT_FOUND',
        message: 'Reporting period not found in this organization',
      });
    }
    return period;
  }

  private asObjectId(v: Types.ObjectId | string): Types.ObjectId {
    return typeof v === 'string' ? new Types.ObjectId(v) : v;
  }

  /** Formats a Date as "DD.MM.YYYY" for human-facing period labels. */
  private formatDmy(d: Date): string {
    const day = String(d.getUTCDate()).padStart(2, '0');
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const year = d.getUTCFullYear();
    return `${day}.${month}.${year}`;
  }
}
