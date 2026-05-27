import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Types } from 'mongoose';

import { isTreasuryInn } from '../constants/treasury';
import {
  Counterparty,
  type CounterpartyDocument,
  type CounterpartyModel,
} from '../schemas/counterparty.schema';

export interface ResolveCounterpartyInput {
  organizationId: Types.ObjectId;
  inn: string | null;
  /** Falls into the new counterparty's `name`. */
  fallbackName: string;
  /** Optional account observed on the bank row — recorded on first sight. */
  accountNumber: string | null;
  /** Optional bank code from the row. */
  bankCode: string | null;
}

export interface ResolveCounterpartyResult {
  counterparty: CounterpartyDocument;
  /** True iff the registry didn't have this ИНН and we created a new row. */
  autoCreated: boolean;
}

/**
 * Counterparty registry lookup with auto-create — bank ТЗ §3.
 *
 * Algorithm (matches the spec's flowchart):
 *   1. ИНН present and registered? → return existing, autoCreated=false.
 *   2. ИНН equals TREASURY_INN (201122919)? → return the treasury counterparty
 *      (creating it once on first sight), autoCreated=false.
 *   3. ИНН present but new? → create a new Counterparty row with
 *      `createdFromBankRow: true`. Surfaces as YELLOW on the preview UI.
 *   4. ИНН absent and `accountNumber` matches a known counterparty's account?
 *      → return that counterparty.
 *   5. Neither — caller decides (typically RED on preview).
 *
 * Account observations: every successful resolve appends the row's
 * `accountNumber` to the counterparty's `accounts[]` if not already present.
 * This builds the counterparty's bank-account history over time and helps
 * the rare ambiguous-ИНН lookups.
 */
@Injectable()
export class CounterpartyResolverService {
  constructor(
    @InjectModel(Counterparty.name)
    private readonly counterpartyModel: CounterpartyModel,
  ) {}

  async resolve(
    input: ResolveCounterpartyInput,
  ): Promise<ResolveCounterpartyResult | null> {
    const { organizationId, inn, fallbackName, accountNumber, bankCode } = input;

    if (inn) {
      const existing = await this.counterpartyModel.findOne({
        organizationId,
        inn,
      });
      if (existing) {
        await this.observeAccount(existing, accountNumber, bankCode);
        return { counterparty: existing, autoCreated: false };
      }

      const isTreasury = isTreasuryInn(inn);
      const created = await this.counterpartyModel.create({
        organizationId,
        inn,
        name: fallbackName,
        accounts: this.accountSeed(accountNumber, bankCode),
        isTreasury,
        // Treasury created by the bank engine should NOT carry the
        // createdFromBankRow yellow flag — it's the well-known treasury
        // counterparty, not a stranger. Same outcome for any future
        // hard-coded known counterparty types.
        createdFromBankRow: !isTreasury,
        isActive: true,
      });
      return { counterparty: created, autoCreated: !isTreasury };
    }

    // ИНН absent — fall back to account lookup. Rare; most bank rows have ИНН.
    if (accountNumber) {
      const byAccount = await this.counterpartyModel.findOne({
        organizationId,
        'accounts.accountNumber': accountNumber,
      });
      if (byAccount) {
        return { counterparty: byAccount, autoCreated: false };
      }
    }

    return null;
  }

  /**
   * Append an observed bank-row account to the counterparty's `accounts[]`
   * iff not already present. Idempotent — the array index covers the
   * exists check.
   */
  private async observeAccount(
    counterparty: CounterpartyDocument,
    accountNumber: string | null,
    bankCode: string | null,
  ): Promise<void> {
    if (!accountNumber) return;
    const already = counterparty.accounts.some((a) => a.accountNumber === accountNumber);
    if (already) return;
    await this.counterpartyModel.updateOne(
      { _id: counterparty._id },
      {
        $push: {
          accounts: {
            accountNumber,
            bankCode: bankCode ?? null,
            firstSeenAt: new Date(),
          },
        },
      },
    );
  }

  private accountSeed(
    accountNumber: string | null,
    bankCode: string | null,
  ): Array<{ accountNumber: string; bankCode: string | null; firstSeenAt: Date }> {
    if (!accountNumber) return [];
    return [{ accountNumber, bankCode: bankCode ?? null, firstSeenAt: new Date() }];
  }
}
