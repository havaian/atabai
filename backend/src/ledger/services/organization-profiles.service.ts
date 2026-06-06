import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Types } from 'mongoose';

import { AppLoggerService } from '../../common/logger/app-logger.service';
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
}

export interface UpsertProfileArgs {
  organizationId: Types.ObjectId | string;
  legalName?: string | null;
  inn?: string | null;
  transitionDate?: Date | null;
  baseCurrency?: string;
  /** When present, REPLACES the whole bankAccounts list. */
  bankAccounts?: OrgBankAccountInput[];
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
    if (args.bankAccounts !== undefined) setPayload.bankAccounts = args.bankAccounts;

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
