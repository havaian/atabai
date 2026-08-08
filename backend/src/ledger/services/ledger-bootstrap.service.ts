import { Injectable } from '@nestjs/common';

import { AppLoggerService } from '../../common/logger/app-logger.service';
import { OrganizationsService } from '../../organizations/organizations.service';
import {
  DEFAULT_ACCOUNTING_POLICY,
  type AccountingPolicyShape,
} from '../constants/accounting-policy';
import type { MembershipDocument } from '../../organizations/schemas/membership.schema';
import type { OrganizationDocument } from '../../organizations/schemas/organization.schema';
import type { UserDocument } from '../../users/schemas/user.schema';
import type { OrganizationProfileDocument } from '../schemas/organization-profile.schema';
import type { ReportingPeriodDocument } from '../schemas/reporting-period.schema';
import { ChartSeedService } from './chart-seed.service';
import { OrganizationProfilesService } from './organization-profiles.service';
import { PeriodsService } from './periods.service';

export interface BootstrapNewOrganizationArgs {
  /** The user creating the org - becomes the bootstrap admin. */
  actor: UserDocument;

  /** Display name (access-spine Organization.name). */
  name: string;

  /** Legal name on rendered statements. Defaults to `name` when omitted. */
  legalName?: string;

  /** Org's own ИНН - for bank-statement attribution (bank ТЗ §2). */
  inn?: string;

  /** Defaults to 'UZS'. */
  baseCurrency?: string;

  /** First-time IFRS adoption transition boundary (architecture doc §7.3). */
  transitionDate: Date;

  /** Calendar year of the first FULL reporting period. */
  firstReportingYear: number;

  /**
   * Accounting policy chosen in onboarding (methodology §9). Partial - any
   * fields the client set; the rest fall back to DEFAULT_ACCOUNTING_POLICY so
   * the stored policy is always complete.
   */
  accountingPolicy?: Partial<AccountingPolicyShape>;
}

export interface BootstrapResult {
  organization: OrganizationDocument;
  membership: MembershipDocument;
  profile: OrganizationProfileDocument;
  periods: ReportingPeriodDocument[];
  chartSeed: { inserted: number; skipped: number; total: number };
}

/**
 * The single entry point that turns an empty intent into a usable tenant.
 *
 * An Organization without a chart of accounts and without reporting periods
 * is a useless shell - the bank engine, ОСВ ingestion and adjustment engine
 * all require both. So the bootstrap is one-shot: every successful call
 * leaves the org ready for ОСВ upload.
 *
 * Step order matters:
 *   1. Create the access-spine Organization + admin Membership (atomic
 *      via OrganizationsService - the membership write rolls the org back
 *      if it fails).
 *   2. Upsert the ledger-side OrganizationProfile (transition date, currency,
 *      ИНН, legal name).
 *   3. Seed the 507-account NSBU chart of accounts for the new org
 *      (idempotent; skip-if-exists).
 *   4. Seed the three first-time-adoption periods (opening, comparative,
 *      reporting). PeriodsService rejects re-runs that would create a
 *      second 'opening' period.
 *
 * Failure handling: if any step after (1) fails, the org is left in a
 * partial state (chart maybe partially seeded, periods missing, etc.).
 * Mongo doesn't give us cross-collection transactions on a standalone
 * deployment, and rolling back individual writes is fragile. The retry
 * story is: step 2 is an upsert (re-runs harmlessly), step 3 is
 * idempotent (skip-if-exists), step 4 currently rejects re-runs with
 * `TRANSITION_ALREADY_SEEDED` - which means a partial bootstrap leaves
 * the operator stuck. Mitigation: a follow-up `LedgerResetService` (out
 * of scope here) for super_admins to wipe a half-bootstrapped org. Until
 * that exists, the operator must run bootstrap atomically - there's no
 * "resume" path.
 */
@Injectable()
export class LedgerBootstrapService {
  constructor(
    private readonly organizations: OrganizationsService,
    private readonly profiles: OrganizationProfilesService,
    private readonly chartSeed: ChartSeedService,
    private readonly periods: PeriodsService,
    private readonly logger: AppLoggerService,
  ) {}

  async bootstrapNewOrganization(
    args: BootstrapNewOrganizationArgs,
  ): Promise<BootstrapResult> {
    const { actor, name, transitionDate, firstReportingYear } = args;

    // 1. Org + admin Membership - atomic at the OrganizationsService layer.
    const { organization, membership } =
      await this.organizations.createOrganization(actor, { name });

    let profile: OrganizationProfileDocument;
    let chartSeedResult: Awaited<
      ReturnType<ChartSeedService['seedForOrganization']>
    >;
    let periods: ReportingPeriodDocument[];

    try {
      // 2. Ledger profile - transition date, requisites, baseline currency,
      // and the 6-block accounting policy. Merge client overrides onto the
      // defaults so the inserted profile always carries a COMPLETE policy
      // (avoids the dotted-path partial-insert edge in the upsert).
      profile = await this.profiles.upsert({
        organizationId: organization._id,
        legalName: args.legalName ?? name,
        inn: args.inn ?? null,
        transitionDate,
        baseCurrency: args.baseCurrency ?? 'UZS',
        accountingPolicy: {
          ...DEFAULT_ACCOUNTING_POLICY,
          ...(args.accountingPolicy ?? {}),
        },
      });

      // 3. Chart of accounts - 507 NSBU accounts, idempotent.
      chartSeedResult = await this.chartSeed.seedForOrganization(organization._id);

      // 4. First-time-adoption periods (opening + comparative + reporting).
      periods = await this.periods.createTransitionPeriods({
        organizationId: organization._id,
        transitionDate,
        firstReportingYear,
        actor,
      });
    } catch (err) {
      // The org now exists in a partial state - log loudly so operators can
      // recover via super_admin tooling, but re-throw so the caller knows
      // the bootstrap did NOT succeed.
      this.logger.error(err, {
        context: 'LedgerBootstrapService.bootstrapNewOrganization',
        orgId: organization._id.toString(),
        orgName: name,
        actor: actor._id.toString(),
        partial: true,
      });
      throw err;
    }

    this.logger.logAction('ledger.bootstrap.completed', {
      orgId: organization._id.toString(),
      orgName: organization.name,
      transitionDate: transitionDate.toISOString(),
      firstReportingYear,
      chartInserted: chartSeedResult.inserted,
      periodIds: periods.map((p) => p._id.toString()),
      actor: actor._id.toString(),
    });

    return {
      organization,
      membership,
      profile,
      periods,
      chartSeed: chartSeedResult,
    };
  }
}
