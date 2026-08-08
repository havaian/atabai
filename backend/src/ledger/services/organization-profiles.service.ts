import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Types } from 'mongoose';

import { AppLoggerService } from '../../common/logger/app-logger.service';
import type { AccountingPolicyShape } from '../constants/accounting-policy';
import {
  OrganizationProfile,
  type OrganizationProfileDocument,
  type OrganizationProfileModel,
} from '../schemas/organization-profile.schema';

/** One settlement account owned by the org (mirrors the OrgBankAccount sub-schema). */
export interface OrgBankAccountInput {
  accountNumber: string;
  bankCode?: string | null;
  label?: string | null;
  currency?: string;
  /** NSBU ledger account this settlement account posts to (e.g. 5110, 5730). */
  ledgerAccount?: string | null;
  /** Sub-account as its own field (methodology §3.5). */
  subAccount?: string | null;
  /** Closed accounts are flagged inactive, never deleted (methodology §3.5). */
  isActive?: boolean;
}

export interface UpsertProfileArgs {
  organizationId: Types.ObjectId | string;
  legalName?: string | null;
  inn?: string | null;
  transitionDate?: Date | null;
  baseCurrency?: string;
  /** Contact requisites (methodology дополнение §2). */
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  /** When present, REPLACES the whole bankAccounts list. */
  bankAccounts?: OrgBankAccountInput[];
  /**
   * Accounting policy (methodology §9). Partial — only the provided fields are
   * merged onto the existing policy, so a PATCH can change one block without
   * resubmitting all six. `undefined` leaves the stored policy untouched.
   */
  accountingPolicy?: Partial<AccountingPolicyShape>;
}

/**
 * CRUD for the ledger-side OrganizationProfile (architecture doc §8.1).
 *
 * 1:1 with access-spine Organization. Created lazily — the first time the
 * ledger bootstrap or any profile-touching operation runs for an org. The
 * service stays small on purpose: profile management touches few fields
 * and doesn't carry workflow state.
 *
 * `transitionDate` updates are intentionally narrowly-scoped to bootstrap
 * flows. Once set, changing it would invalidate every downstream balance
 * and adjustment — there's no API exposed for changing it in flight, only
 * for clearing/setting during initial setup. A bigger "redo first-time
 * adoption" workflow lives in [[project-ledger-spine]] open questions.
 */
@Injectable()
export class OrganizationProfilesService {
  constructor(
    @InjectModel(OrganizationProfile.name)
    private readonly profileModel: OrganizationProfileModel,
    private readonly logger: AppLoggerService,
  ) {}

  /**
   * Upsert a profile by `organizationId`. Only the provided fields are
   * touched; `undefined` means "leave existing value". Pass `null`
   * explicitly to clear a field.
   */
  async upsert(args: UpsertProfileArgs): Promise<OrganizationProfileDocument> {
    const orgId =
      typeof args.organizationId === 'string'
        ? new Types.ObjectId(args.organizationId)
        : args.organizationId;

    const setPayload: Record<string, unknown> = {};
    if (args.legalName !== undefined) setPayload.legalName = args.legalName;
    if (args.inn !== undefined) setPayload.inn = args.inn;
    if (args.transitionDate !== undefined) setPayload.transitionDate = args.transitionDate;
    if (args.baseCurrency !== undefined) setPayload.baseCurrency = args.baseCurrency;
    if (args.address !== undefined) setPayload.address = args.address;
    if (args.phone !== undefined) setPayload.phone = args.phone;
    if (args.email !== undefined) setPayload.email = args.email;
    if (args.bankAccounts !== undefined) {
      // §3.5: account-number uniqueness is validated on the FULL number
      // ("по всем знакам целиком"), not a prefix. The PATCH replaces the
      // whole list, so a duplicate here would mean the same physical account
      // entered twice — reject the whole write rather than silently storing
      // both. Comparison is on the trimmed accountNumber exactly as the
      // schema stores it.
      const seen = new Set<string>();
      for (const acc of args.bankAccounts) {
        const num = (acc.accountNumber ?? '').trim();
        if (!num) continue; // shape is enforced by the DTO; skip blanks defensively.
        if (seen.has(num)) {
          throw new BadRequestException({
            error: 'DUPLICATE_BANK_ACCOUNT',
            message: `Settlement account ${num} is listed more than once. Each account number must be unique.`,
          });
        }
        seen.add(num);
      }
      setPayload.bankAccounts = args.bankAccounts;
    }
    if (args.accountingPolicy !== undefined) {
      // Partial merge: set only the provided block fields via dotted paths so
      // an edit to one block leaves the others intact. Schema enums validate
      // the values on save. Keys are whitelisted against the known policy
      // shape so an unexpected field can't write an arbitrary path.
      const policy = args.accountingPolicy;
      const allowed: Array<keyof typeof policy> = [
        'taxRegime',
        'vatPayer',
        'vatRate',
        'inventoryValuation',
        'allowNegativeStock',
        'settlementDepth',
        'payrollDetail',
        'leaveReserve',
        // Array — the dotted $set replaces the whole list, which is what the
        // edit form submits (methodology дополнение §6: manual, full-set edit).
        'nonMonetaryAccounts',
      ];
      for (const key of allowed) {
        if (policy[key] !== undefined) {
          setPayload[`accountingPolicy.${key}`] = policy[key];
        }
      }
    }

    const profile = await this.profileModel.findOneAndUpdate(
      { organizationId: orgId },
      { $set: setPayload, $setOnInsert: { organizationId: orgId } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    if (!profile) {
      // findOneAndUpdate with upsert should never return null, but guard anyway.
      throw new Error('OrganizationProfile upsert returned null');
    }

    this.logger.logAction('ledger.profile.upserted', {
      orgId: orgId.toString(),
      profileId: profile._id.toString(),
      fieldsTouched: Object.keys(setPayload),
    });

    return profile;
  }

  async getByOrgId(
    organizationId: Types.ObjectId | string,
  ): Promise<OrganizationProfileDocument> {
    const orgId =
      typeof organizationId === 'string'
        ? new Types.ObjectId(organizationId)
        : organizationId;
    const profile = await this.profileModel.findOne({ organizationId: orgId });
    if (!profile) {
      throw new NotFoundException({
        error: 'PROFILE_NOT_FOUND',
        message: 'Ledger profile not found for this organization',
      });
    }
    return profile;
  }

  async findByOrgId(
    organizationId: Types.ObjectId | string,
  ): Promise<OrganizationProfileDocument | null> {
    const orgId =
      typeof organizationId === 'string'
        ? new Types.ObjectId(organizationId)
        : organizationId;
    return this.profileModel.findOne({ organizationId: orgId });
  }

  /**
   * Read the profile, creating an empty one if the org never went through a
   * profile-touching flow. Used by the GET endpoint so the admin edit screen
   * always has a document to populate instead of a 404. Touches no fields on
   * create beyond the organizationId, so schema defaults apply.
   */
  async ensureForOrg(
    organizationId: Types.ObjectId | string,
  ): Promise<OrganizationProfileDocument> {
    const existing = await this.findByOrgId(organizationId);
    if (existing) return existing;
    return this.upsert({ organizationId });
  }
}
