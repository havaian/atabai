import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as crypto from 'crypto';
import { Types, isValidObjectId } from 'mongoose';

import { AppLoggerService } from '../../common/logger/app-logger.service';
import type { UserDocument } from '../../users/schemas/user.schema';
import {
  DEFAULT_ACCOUNTING_POLICY,
  resolveSettlementDepth,
  SETTLEMENT_DEPTH,
  type SettlementDepth,
} from '../constants/accounting-policy';
import {
  INVOICE_DIRECTION,
  INVOICE_SUBTYPE,
  INVOICE_VAT_ACCOUNTS,
  type InvoiceDirection,
} from '../constants/invoice';
import {
  BANK_POSTING_ACCOUNTS,
  UNRESOLVED_ACCOUNT,
} from '../bank/bank-accounts';
import { CounterpartyResolverService } from '../bank/counterparty-resolver.service';
import {
  addDecimals,
  compareDecimals,
  toDecimal128,
} from '../decimal-arithmetic';
import {
  ChartOfAccount,
  type ChartOfAccountModel,
} from '../schemas/chart-of-account.schema';
import {
  Counterparty,
  type CounterpartyModel,
} from '../schemas/counterparty.schema';
import {
  Invoice,
  type InvoiceDocument,
  type InvoiceModel,
} from '../schemas/invoice.schema';
import {
  JournalEntryLine,
  type JournalEntryLineModel,
} from '../schemas/journal-entry-line.schema';
import {
  JournalEntry,
  type JournalEntryDocument,
  type JournalEntryModel,
  type JournalEntryStatus,
} from '../schemas/journal-entry.schema';
import {
  OrganizationProfile,
  type OrganizationProfileModel,
} from '../schemas/organization-profile.schema';
import {
  ReportingPeriod,
  type ReportingPeriodModel,
} from '../schemas/reporting-period.schema';
import { BalanceRollupService } from '../services/balance-rollup.service';
import { PeriodsService } from '../services/periods.service';
import { DocumentsService } from './documents.service';
import {
  parseInvoiceRegistry,
  type ParsedRegistryInvoice,
} from './invoice-registry-parser';

export type InvoicePreviewColor = 'green' | 'yellow' | 'red';

export interface InvoiceIngestionSummary {
  uploadId: string;
  direction: InvoiceDirection;
  /** Standard invoices that produced postings. */
  postedDrafts: number;
  /** Of postedDrafts, the green/yellow/red breakdown. */
  byColor: Record<InvoicePreviewColor, number>;
  /** Corrected/Additional invoices: records captured, posting deferred (phase 4). */
  deferredSubtype: number;
  /** Invoices already loaded in a prior upload (same number) — skipped. */
  alreadyLoaded: number;
  /** Contracts auto-created from the registry's contract columns. */
  contractsCreated: number;
  /** Invoices whose status was not «Подписан» — counted by the parser, not loaded. */
  skippedUnsigned: number;
  parseWarnings: string[];
  rowsSkipped: number;
}

interface IngestInvoiceArgs {
  organizationId: Types.ObjectId | string;
  periodId: Types.ObjectId | string;
  filePath: string;
  direction: InvoiceDirection;
  actor: UserDocument;
}

interface CommitInvoiceArgs {
  organizationId: Types.ObjectId | string;
  periodId: Types.ObjectId | string;
  uploadId: string;
  actor: UserDocument;
}

/** Resolved once per batch from the org profile. */
interface InvoiceBatchContext {
  /** The company default settlement depth (contract / invoice). */
  companyDepth: SettlementDepth;
}

/**
 * Invoice-registry ingestion + posting orchestrator — methodology §7,
 * status_and_build_plan §7.3–§7.6 (build phases 1–3).
 *
 * Per invoice (one «Подписан» registry invoice, grouped from its line rows):
 *   1. Resolve the counterparty by ИНН (find or auto-create — exactly as the
 *      bank engine does; an auto-created one paints the row YELLOW).
 *   2. Auto-link / create the Contract from the «Номер/Дата договора» columns
 *      (methodology §7.6 phase 1). Always done when a contract number is
 *      present, regardless of settlement depth.
 *   3. Post per the template (status_and_build_plan §7.3), summed across lines:
 *
 *      INCOMING (Входящие — supplier, we buy → payable 6010):
 *        Дт <operator account> per line  = line net   (operator picks account)
 *        Дт 4410                         = Σ input VAT (omitted when 0)
 *        Кт 6010 (counterparty)          = Σ gross
 *
 *      OUTGOING (Исходящие — customer, we sell → receivable 4010):
 *        Дт 4010 (counterparty)          = Σ gross
 *        Кт <operator account> per line  = line net   (operator picks account)
 *        Кт 6410                         = Σ output VAT (omitted when 0)
 *
 *   4. The per-line operator account is the OPERATOR's manual pick (Filipp,
 *      §7.2 — "same shape as the bank treasury red-row fix"). Until set, each
 *      operator leg carries the placeholder account '000' → the invoice is RED
 *      and blocked from commit, exactly like an unrecognised bank treasury row.
 *
 *   5. The payable/receivable leg (6010/4010) carries the counterparty as its
 *      subconto AND the settlement document — the Invoice itself when the
 *      counterparty settles by invoice, or the auto-linked Contract when it
 *      settles by contract (methodology §7.4 + resolveSettlementDepth). That is
 *      what lets the future bank↔invoice зачёт (build phase 6) find this debt
 *      per document via RunningBalanceService.getDocumentPosition.
 *
 * Subtypes (methodology §7.5): CORRECTED (Исправленная) and ADDITIONAL
 * (Дополнительная) invoices are PARSED and their Invoice records created (with
 * the old-invoice link) so the data is captured, but they are NOT posted here
 * — the reopen-reverse-repost / merged-delta posting is build phase 4. They
 * are reported in the summary as `deferredSubtype`.
 *
 * Ingestion is SYNCHRONOUS (the request returns the summary directly). The
 * bank module's async upload-job pattern can be lifted onto this verbatim if
 * registries grow large enough to risk an HTTP timeout; it is deliberately
 * left out of this first slice to keep the moving parts down.
 *
 * The whole batch shares one `uploadId`, captured both on each Invoice
 * (`sourceUploadId`) and on each JournalEntry's `sourceRef`
 * (`invoice:{uploadId}:{rowIndex}`), so an upload's drafts can be listed,
 * previewed, committed, or re-found as a group.
 */
@Injectable()
export class InvoiceIngestionService {
  constructor(
    @InjectModel(JournalEntry.name)
    private readonly entryModel: JournalEntryModel,
    @InjectModel(JournalEntryLine.name)
    private readonly lineModel: JournalEntryLineModel,
    @InjectModel(ChartOfAccount.name)
    private readonly chartModel: ChartOfAccountModel,
    @InjectModel(Counterparty.name)
    private readonly counterpartyModel: CounterpartyModel,
    @InjectModel(Invoice.name)
    private readonly invoiceModel: InvoiceModel,
    @InjectModel(OrganizationProfile.name)
    private readonly profileModel: OrganizationProfileModel,
    @InjectModel(ReportingPeriod.name)
    private readonly periodModel: ReportingPeriodModel,
    private readonly periods: PeriodsService,
    private readonly counterparties: CounterpartyResolverService,
    private readonly documents: DocumentsService,
    private readonly balanceRollup: BalanceRollupService,
    private readonly logger: AppLoggerService,
  ) {}

  // ─── Upload + parse + create drafts ────────────────────────────────────────

  async ingestFromFile(args: IngestInvoiceArgs): Promise<InvoiceIngestionSummary> {
    const orgId = this.oid(args.organizationId);
    const periodId = this.oid(args.periodId);

    await this.periods.assertWritable(orgId, periodId);

    const uploadId = crypto.randomUUID();
    const summary = await this.parseAndCreateDrafts(
      orgId,
      periodId,
      uploadId,
      args.filePath,
      args.direction,
      args.actor,
    );

    this.logger.logAction('ledger.invoice.ingested', {
      orgId: orgId.toString(),
      periodId: periodId.toString(),
      direction: args.direction,
      actor: args.actor._id.toString(),
      ...summary,
    });

    return summary;
  }

  private async parseAndCreateDrafts(
    orgId: Types.ObjectId,
    periodId: Types.ObjectId,
    uploadId: string,
    filePath: string,
    direction: InvoiceDirection,
    actor: UserDocument,
  ): Promise<InvoiceIngestionSummary> {
    const parsed = parseInvoiceRegistry(filePath, direction);

    if (parsed.invoices.length === 0) {
      // Nothing signed/loadable — surface a clear 4xx rather than an empty post.
      throw new BadRequestException({
        error: 'INVOICE_REGISTRY_EMPTY',
        message:
          parsed.skippedUnsigned > 0
            ? 'The registry contains no «Подписан» invoices to load.'
            : 'The registry contained no invoice rows.',
      });
    }

    const profile = await this.profileModel.findOne({ organizationId: orgId }).lean();
    const ctx: InvoiceBatchContext = {
      companyDepth:
        profile?.accountingPolicy?.settlementDepth ??
        DEFAULT_ACCOUNTING_POLICY.settlementDepth,
    };

    const byColor: Record<InvoicePreviewColor, number> = { green: 0, yellow: 0, red: 0 };
    let postedDrafts = 0;
    let deferredSubtype = 0;
    let alreadyLoaded = 0;
    let contractsCreated = 0;
    let rowsSkipped = 0;
    const warnings = [...parsed.warnings];

    for (const inv of parsed.invoices) {
      try {
        const outcome = await this.ingestOneInvoice({
          orgId,
          periodId,
          uploadId,
          inv,
          actor,
          ctx,
        });
        if (outcome.kind === 'posted') {
          postedDrafts++;
          byColor[outcome.color!]++;
        } else if (outcome.kind === 'deferred') {
          deferredSubtype++;
        } else if (outcome.kind === 'already_loaded') {
          alreadyLoaded++;
        } else if (outcome.kind === 'skipped') {
          rowsSkipped++;
        }
        if (outcome.contractCreated) contractsCreated++;
        if (outcome.warning) warnings.push(outcome.warning);
      } catch (err) {
        rowsSkipped++;
        this.logger.error(err, {
          context: 'InvoiceIngestionService.ingestOneInvoice',
          uploadId,
          sourceRow: inv.sourceRow,
        });
      }
    }

    return {
      uploadId,
      direction,
      postedDrafts,
      byColor,
      deferredSubtype,
      alreadyLoaded,
      contractsCreated,
      skippedUnsigned: parsed.skippedUnsigned,
      parseWarnings: warnings,
      rowsSkipped,
    };
  }

  /**
   * Ingest one parsed registry invoice: resolve counterparty, auto-link the
   * contract, create the Invoice record, and (for standard invoices) the draft
   * posting. Returns what happened so the batch loop can tally it.
   */
  private async ingestOneInvoice(args: {
    orgId: Types.ObjectId;
    periodId: Types.ObjectId;
    uploadId: string;
    inv: ParsedRegistryInvoice;
    actor: UserDocument;
    ctx: InvoiceBatchContext;
  }): Promise<{
    kind: 'posted' | 'deferred' | 'already_loaded' | 'skipped';
    color?: InvoicePreviewColor;
    contractCreated?: boolean;
    warning?: string;
  }> {
    const { orgId, periodId, uploadId, inv, actor, ctx } = args;

    // An invoice with no ИНН can't be booked to a counterparty position; the
    // registry always carries it, so a missing one is a data error → skip.
    if (!inv.counterpartyInn) {
      return {
        kind: 'skipped',
        warning: `Invoice ${inv.number} (row ${inv.sourceRow}) has no counterparty ИНН — skipped`,
      };
    }

    // 1. Counterparty (find or auto-create) — same resolver as the bank engine.
    const resolved = await this.counterparties.resolve({
      organizationId: orgId,
      inn: inv.counterpartyInn,
      fallbackName: inv.counterpartyName,
      accountNumber: null,
      bankCode: null,
    });
    if (!resolved) {
      return {
        kind: 'skipped',
        warning: `Invoice ${inv.number}: could not resolve counterparty — skipped`,
      };
    }
    const counterpartyId = resolved.counterparty._id;
    const counterpartyAutoCreated = resolved.counterparty.createdFromBankRow === true;

    // 2. Dedup — an invoice already loaded (same org+counterparty+number) is not
    //    re-posted. Prevents a re-upload double-counting.
    const existing = await this.documents.findByNumber(
      orgId,
      counterpartyId,
      'invoice',
      inv.number,
    );
    if (existing) {
      return { kind: 'already_loaded' };
    }

    // 3. Auto-link / create the contract from the contract columns.
    let contractId: Types.ObjectId | null = null;
    let contractCreated = false;
    if (inv.contractNumber) {
      const { ref, wasCreated } = await this.documents.findOrCreate({
        organizationId: orgId,
        counterpartyId,
        kind: 'contract',
        number: inv.contractNumber,
        date: inv.contractDate,
      });
      contractId = new Types.ObjectId(ref.id);
      contractCreated = wasCreated;
    }

    // 4. Totals — summed from the lines (never the registry's own total cell),
    //    so the posting balances by construction even if the export's gross
    //    column disagrees by a rounding unit.
    const netTotal = addDecimals(...inv.lineItems.map((l) => l.netAmount));
    const vatTotal = addDecimals(...inv.lineItems.map((l) => l.vatAmount));
    const grossTotal = addDecimals(netTotal, vatTotal);

    // 5. Create the Invoice record (always — captures the document even for the
    //    deferred subtypes). amount mirrors grossTotal for the existing
    //    DocumentsService consumers.
    const invoiceDoc = await this.invoiceModel.create({
      organizationId: orgId,
      counterpartyId,
      number: inv.number,
      date: inv.date,
      amount: toDecimal128(grossTotal),
      description: null,
      direction: inv.direction,
      subtype: inv.subtype,
      documentStatus: inv.documentStatus,
      didoxId: inv.didoxId,
      roumingId: inv.roumingId,
      oldInvoiceDidoxId: inv.oldInvoiceDidoxId,
      contractNumber: inv.contractNumber,
      contractDate: inv.contractDate,
      contractId,
      lineItems: inv.lineItems.map((l) => ({
        ikpuCode: l.ikpuCode,
        ikpuName: l.ikpuName,
        quantity: l.quantity ? toDecimal128(l.quantity) : null,
        price: l.price ? toDecimal128(l.price) : null,
        netAmount: toDecimal128(l.netAmount),
        vatRate: l.vatRate,
        vatAmount: toDecimal128(l.vatAmount),
        grossAmount: toDecimal128(l.grossAmount),
      })),
      netTotal: toDecimal128(netTotal),
      vatTotal: toDecimal128(vatTotal),
      grossTotal: toDecimal128(grossTotal),
      sourceUploadId: uploadId,
      isActive: true,
    });

    // 6. The settlement document for the payable/receivable leg (used by the
    //    standard, additional and corrected-repost postings alike).
    const depth = resolveSettlementDepth(
      resolved.counterparty.settlementDepth,
      ctx.companyDepth,
    );
    const settlementDoc =
      depth === SETTLEMENT_DEPTH.CONTRACT
        ? contractId
          ? { documentType: 'contract' as const, documentId: contractId }
          : null // settles by contract but none present — leg carries no document
        : { documentType: 'invoice' as const, documentId: invoiceDoc._id };

    // 7. Post per subtype (methodology §7.5, build phase 4):
    //
    //   STANDARD / ADDITIONAL — a fresh posting in the period being loaded
    //   (Filipp: the дополнительная delta posts to the current period, dated to
    //   the additional СФ; the additional invoice carries the delta itself, so
    //   it posts exactly like a standard invoice — its own amount, its own
    //   document, same counterparty — and surfaces as a new open position). A
    //   NEGATIVE дополнительная (a reduction — Filipp confirmed these occur) is
    //   handled inside createDraftForInvoice: the legs flip Дт↔Кт and post the
    //   absolute amount, reducing the same positions instead of raising them.
    //
    //   CORRECTED — replaces a prior invoice (Filipp, variant a): on commit,
    //   reverse the original (dated to the original СФ) and repost the corrected
    //   version (same original date), BOTH in the original's period, so that
    //   period nets to exactly the corrected figures. The repost draft is
    //   created here against the original's period; the reversal happens at
    //   commit. зачёт interaction stays a phase-6 concern (no зачёт exists yet).
    if (inv.subtype === INVOICE_SUBTYPE.CORRECTED) {
      // Find the original invoice by its Didox id, then its committed posting.
      const originalInvoice = inv.oldInvoiceDidoxId
        ? await this.invoiceModel.findOne({
            organizationId: orgId,
            didoxId: inv.oldInvoiceDidoxId,
          })
        : null;
      if (!originalInvoice || !originalInvoice.journalEntryId) {
        return {
          kind: 'skipped',
          contractCreated,
          warning: `Corrected invoice ${inv.number}: original (Didox ${
            inv.oldInvoiceDidoxId ?? '—'
          }) not found or not yet posted — skipped`,
        };
      }
      const originalEntry = await this.entryModel.findById(originalInvoice.journalEntryId);
      if (!originalEntry || originalEntry.status !== 'committed') {
        return {
          kind: 'skipped',
          contractCreated,
          warning: `Corrected invoice ${inv.number}: original posting is not committed — skipped`,
        };
      }

      const color = await this.createDraftForInvoice({
        orgId,
        periodId,
        uploadId,
        inv,
        invoiceDoc,
        counterpartyId,
        counterpartyAutoCreated,
        vatTotal,
        grossTotal,
        settlementDoc,
        actor,
        // Repost into the original's period, dated to the original СФ (§7.5),
        // and tag the entry so commit reverses the original first.
        targetPeriodId: originalEntry.periodId,
        entryDate: originalEntry.date,
        correctsEntryId: originalEntry._id,
      });
      return { kind: 'posted', color, contractCreated };
    }

    // STANDARD or ADDITIONAL — post in the ingestion period.
    const color = await this.createDraftForInvoice({
      orgId,
      periodId,
      uploadId,
      inv,
      invoiceDoc,
      counterpartyId,
      counterpartyAutoCreated,
      vatTotal,
      grossTotal,
      settlementDoc,
      actor,
    });

    return { kind: 'posted', color, contractCreated };
  }

  /**
   * Build the draft JournalEntry + lines for an invoice per the §7.3 template,
   * and link the Invoice to it. Returns the preview color.
   *
   * By default the entry posts in the ingestion period dated to the invoice's
   * own date (standard / additional). A corrected invoice overrides
   * `targetPeriodId` / `entryDate` to the ORIGINAL invoice's period and date,
   * and sets `correctsEntryId` to the original entry so commit reverses it
   * first (methodology §7.5).
   */
  private async createDraftForInvoice(args: {
    orgId: Types.ObjectId;
    periodId: Types.ObjectId;
    uploadId: string;
    inv: ParsedRegistryInvoice;
    invoiceDoc: InvoiceDocument;
    counterpartyId: Types.ObjectId;
    counterpartyAutoCreated: boolean;
    vatTotal: string;
    grossTotal: string;
    settlementDoc: { documentType: 'contract' | 'invoice'; documentId: Types.ObjectId } | null;
    actor: UserDocument;
    targetPeriodId?: Types.ObjectId;
    entryDate?: Date;
    correctsEntryId?: Types.ObjectId | null;
  }): Promise<InvoicePreviewColor> {
    const {
      orgId,
      periodId,
      uploadId,
      inv,
      invoiceDoc,
      counterpartyId,
      counterpartyAutoCreated,
      vatTotal,
      grossTotal,
      settlementDoc,
      actor,
    } = args;

    // Corrected invoices post into the original's period at the original date;
    // everything else posts in the ingestion period at the invoice's own date.
    const entryPeriodId = args.targetPeriodId ?? periodId;
    const date = args.entryDate ?? inv.date ?? new Date();
    const isIncoming = inv.direction === INVOICE_DIRECTION.INCOMING;
    const hasVat = compareDecimals(vatTotal, '0') !== 0; // non-zero, either sign

    // A negative дополнительная (a reduction — Filipp confirmed these occur:
    // «может быть с минусом») posts the SAME legs as a positive invoice but with
    // each Дт↔Кт flipped and the ABSOLUTE amount, so it REDUCES the
    // receivable/revenue/output-VAT (outgoing) or payable/expense/input-VAT
    // (incoming) a positive one would raise — without breaking the line
    // amount-≥-0 invariant. Only an additional is ever negative; standard and
    // corrected carry positive figures, so a negative gross is the signal.
    //
    // Filipp confirmed (01.07.26): the reduction books against the
    // receivable/payable (4010/6010), symmetric with the positive additional —
    // NOT advances (6310/4310). Booking to advances would depend on settlement
    // state (зачёт), which is a phase-6 concern.
    const isReduction = compareDecimals(grossTotal, '0') < 0;
    const absDecimal = (s: string): string => {
      const t = s.trim();
      return t.startsWith('-') ? t.slice(1) : t;
    };
    const legDir = (natural: 'debit' | 'credit'): 'debit' | 'credit' =>
      isReduction ? (natural === 'debit' ? 'credit' : 'debit') : natural;

    const entry = await this.entryModel.create({
      organizationId: orgId,
      periodId: entryPeriodId,
      date,
      description: `${inv.number} — ${inv.counterpartyName}`.substring(0, 1990),
      source: 'manual', // invoices are operator-sourced documents (not bank rows)
      sourceRef: `invoice:${uploadId}:${inv.sourceRow}`,
      status: 'draft',
      totalAmount: toDecimal128(absDecimal(grossTotal)),
      createdBy: actor._id,
      correctsEntryId: args.correctsEntryId ?? null,
    });

    // Link the invoice to its posting (used by future corrections to find this
    // invoice's entry, and by the preview to read the subtype back).
    invoiceDoc.journalEntryId = entry._id;
    await invoiceDoc.save();

    // Common subconto/document stamp for the counterparty (payable/receivable)
    // leg — carries who and (per settlement depth) which document the debt is
    // booked against, so the future зачёт can find it per document.
    const counterpartyLeg = {
      counterpartyId,
      subconto1Value: counterpartyId.toString(),
      documentType: settlementDoc?.documentType ?? null,
      documentId: settlementDoc?.documentId ?? null,
    };

    const lines: Array<Record<string, unknown>> = [];

    // Operator-account legs (one per line item): placeholder '000' until the
    // operator picks the real expense/inventory/asset (incoming) or revenue
    // (outgoing) account. These carry NO counterparty — the account's analytic
    // is the item/cost-centre, not the supplier/customer.
    for (const item of inv.lineItems) {
      lines.push({
        entryId: entry._id,
        organizationId: orgId,
        periodId: entryPeriodId,
        date,
        accountCode: UNRESOLVED_ACCOUNT,
        direction: legDir(isIncoming ? 'debit' : 'credit'),
        amount: toDecimal128(absDecimal(item.netAmount)),
        counterpartyId: null,
        subconto1Value: null,
        description: this.lineLabel(item.ikpuCode, item.ikpuName),
      });
    }

    // VAT leg (4410 input on the buy side / 6410 output on the sell side),
    // omitted entirely when the invoice is 0 % / exempt (§7.3).
    if (hasVat) {
      lines.push({
        entryId: entry._id,
        organizationId: orgId,
        periodId: entryPeriodId,
        date,
        accountCode: isIncoming ? INVOICE_VAT_ACCOUNTS.INPUT : INVOICE_VAT_ACCOUNTS.OUTPUT,
        direction: legDir(isIncoming ? 'debit' : 'credit'),
        amount: toDecimal128(absDecimal(vatTotal)),
        counterpartyId: null,
        subconto1Value: null,
        description: `${inv.number} — ${isIncoming ? 'input' : 'output'} VAT`,
      });
    }

    // Counterparty leg — 6010 (credit, incoming) or 4010 (debit, outgoing) for
    // the gross. The single leg that carries the counterparty + document.
    lines.push({
      entryId: entry._id,
      organizationId: orgId,
      periodId: entryPeriodId,
      date,
      accountCode: isIncoming
        ? BANK_POSTING_ACCOUNTS.ACCOUNTS_PAYABLE
        : BANK_POSTING_ACCOUNTS.ACCOUNTS_RECEIVABLE,
      direction: legDir(isIncoming ? 'credit' : 'debit'),
      amount: toDecimal128(absDecimal(grossTotal)),
      ...counterpartyLeg,
      description: `${inv.number} — ${inv.counterpartyName}`,
    });

    await this.lineModel.create(lines);

    // Color: RED while any operator leg is still the placeholder (always true at
    // creation — the operator must pick the line accounts), YELLOW for an
    // auto-created counterparty, GREEN otherwise. Since every fresh invoice has
    // unset operator legs, a just-created standard invoice is RED until fixed —
    // exactly the intended "pick the account" prompt (§7.2).
    if (inv.lineItems.length > 0) return 'red';
    if (counterpartyAutoCreated) return 'yellow';
    return 'green';
  }

  // ─── List drafts for a batch (preview screen) ───────────────────────────────

  /**
   * Enriched draft listing for the invoice-preview screen. Each invoice draft
   * is returned with its server-derived color and its OPERATOR LINES (the legs
   * the operator must assign an account to), so the preview can render a
   * per-line account picker.
   *
   * Operator legs are identified structurally: a leg with no counterparty that
   * is not a VAT account (4410/6410). The counterparty leg (6010/4010) carries
   * the counterparty; the VAT leg is 4410/6410; everything else is a line the
   * operator picks the account for. This holds before and after the account is
   * set (it never gains a counterparty), so the same legs stay identifiable.
   */
  async listDraftsForUpload(args: {
    organizationId: Types.ObjectId | string;
    uploadId: string;
    statuses?: JournalEntryStatus[];
  }): Promise<Array<{
    entry: JournalEntryDocument;
    color: InvoicePreviewColor;
    reason: string;
    direction: 'incoming' | 'outgoing' | null;
    counterpartyName: string | null;
    subtype: 'standard' | 'additional' | 'corrected';
    periodId: string;
    periodLabel: string | null;
    /** True when this draft's period is locked — commit will skip it until reopened. */
    periodLocked: boolean;
    operatorLines: Array<{
      lineId: string;
      label: string;
      amount: string;
      accountCode: string | null; // null when still the placeholder
    }>;
  }>> {
    const orgId = this.oid(args.organizationId);
    const statusFilter =
      args.statuses && args.statuses.length > 0 ? args.statuses : ['draft'];

    const entries = await this.entryModel
      .find({
        organizationId: orgId,
        source: 'manual',
        status: { $in: statusFilter },
        sourceRef: { $regex: `^invoice:${this.escapeRegex(args.uploadId)}:` },
      })
      .sort({ date: 1, sourceRef: 1 });

    if (entries.length === 0) return [];

    const entryIds = entries.map((e) => e._id);
    const allLines = await this.lineModel
      .find({ entryId: { $in: entryIds } })
      .select('entryId accountCode counterpartyId direction amount description')
      .lean();
    const linesByEntryId = new Map<string, typeof allLines>();
    for (const line of allLines) {
      const key = line.entryId.toString();
      const bucket = linesByEntryId.get(key);
      if (bucket) bucket.push(line);
      else linesByEntryId.set(key, [line]);
    }

    // Counterparty names for the auto-created (yellow) check + display.
    const counterpartyIds = Array.from(
      new Set(
        allLines
          .map((l) => l.counterpartyId?.toString())
          .filter((id): id is string => typeof id === 'string'),
      ),
    );
    const counterparties =
      counterpartyIds.length > 0
        ? await this.counterpartyModel
            .find({ _id: { $in: counterpartyIds.map((id) => new Types.ObjectId(id)) } })
            .select('_id name createdFromBankRow')
            .lean()
        : [];
    const cpartyById = new Map(counterparties.map((c) => [c._id.toString(), c]));

    const isVatAccount = (code: string): boolean =>
      code === INVOICE_VAT_ACCOUNTS.INPUT || code === INVOICE_VAT_ACCOUNTS.OUTPUT;

    // Subtype per entry — corrected is detectable from correctsEntryId on the
    // entry itself; standard vs additional comes from the linked Invoice.
    const linkedInvoices = await this.invoiceModel
      .find({ organizationId: orgId, journalEntryId: { $in: entryIds } })
      .select('journalEntryId subtype')
      .lean();
    const subtypeByEntryId = new Map<string, 'standard' | 'additional' | 'corrected'>();
    for (const li of linkedInvoices) {
      if (li.journalEntryId) {
        subtypeByEntryId.set(
          li.journalEntryId.toString(),
          li.subtype as 'standard' | 'additional' | 'corrected',
        );
      }
    }

    // Label + lock status for each entry's period (a corrected repost's period
    // can differ from the ingestion period).
    const periodIds = Array.from(new Set(entries.map((e) => e.periodId.toString())));
    const periodDocs = await this.periodModel
      .find({ _id: { $in: periodIds.map((id) => new Types.ObjectId(id)) } })
      .select('_id label status')
      .lean();
    const periodById = new Map(periodDocs.map((p) => [p._id.toString(), p]));

    return entries.map((entry) => {
      const lines = linesByEntryId.get(entry._id.toString()) ?? [];

      // Operator legs: no counterparty, not a VAT account.
      const operatorLines = lines
        .filter((l) => !l.counterpartyId && !isVatAccount(l.accountCode))
        .map((l) => ({
          lineId: l._id.toString(),
          label: l.description || '',
          amount: l.amount.toString(),
          accountCode: l.accountCode === UNRESOLVED_ACCOUNT ? null : l.accountCode,
        }));

      const counterpartyLine = lines.find((l) => l.counterpartyId);
      const cparty = counterpartyLine?.counterpartyId
        ? cpartyById.get(counterpartyLine.counterpartyId.toString())
        : null;
      const counterpartyName = cparty?.name ?? null;

      // Direction from which side the counterparty (gross) leg sits on:
      // debit = receivable (outgoing, we sell); credit = payable (incoming).
      const direction: 'incoming' | 'outgoing' | null = counterpartyLine
        ? counterpartyLine.direction === 'debit'
          ? 'outgoing'
          : 'incoming'
        : null;

      const subtype: 'standard' | 'additional' | 'corrected' = entry.correctsEntryId
        ? 'corrected'
        : subtypeByEntryId.get(entry._id.toString()) ?? 'standard';
      const period = periodById.get(entry.periodId.toString());
      const periodLabel = period?.label ?? null;
      const periodLocked = period?.status === 'locked';

      // Color: RED if any operator account is unset, else YELLOW for an
      // auto-created counterparty, else GREEN. (A green-but-locked corrected
      // repost is reported via periodLocked; commit skips it until reopened.)
      let color: InvoicePreviewColor = 'green';
      let reason = '';
      if (operatorLines.some((l) => l.accountCode === null)) {
        color = 'red';
        reason = 'Pick an account for each invoice line before posting';
      } else if (cparty?.createdFromBankRow) {
        color = 'yellow';
        reason = 'Counterparty auto-created from this registry — verify';
      }

      return {
        entry,
        color,
        reason,
        direction,
        counterpartyName,
        subtype,
        periodId: entry.periodId.toString(),
        periodLabel,
        periodLocked,
        operatorLines,
      };
    });
  }

  // ─── Edit a draft (operator picks the per-line accounts) ────────────────────

  /**
   * Set the operator accounts on an invoice draft's line legs. `lineAccounts`
   * maps a leg id → the chosen NSBU account. Each account is validated against
   * the org's chart, then stamped on the leg. Only operator legs (no
   * counterparty, not a VAT account) of a draft in this upload batch can be
   * set — the counterparty and VAT legs are engine-fixed.
   */
  async updateDraft(args: {
    organizationId: Types.ObjectId | string;
    periodId: Types.ObjectId | string;
    uploadId: string;
    entryId: string;
    lineAccounts: Array<{ lineId: string; accountCode: string }>;
    actor: UserDocument;
  }): Promise<JournalEntryDocument> {
    const orgId = this.oid(args.organizationId);

    if (!args.lineAccounts || args.lineAccounts.length === 0) {
      throw new BadRequestException({
        error: 'EMPTY_PATCH',
        message: 'Provide at least one line account to set.',
      });
    }

    if (!isValidObjectId(args.entryId)) {
      throw new NotFoundException({ error: 'DRAFT_NOT_FOUND', message: 'Draft not found' });
    }
    // Find the draft by upload + id across periods (a corrected repost lives in
    // the original's period, not the ingestion period).
    const entry = await this.entryModel.findOne({
      _id: new Types.ObjectId(args.entryId),
      organizationId: orgId,
      source: 'manual',
      status: 'draft',
      sourceRef: { $regex: `^invoice:${this.escapeRegex(args.uploadId)}:` },
    });
    if (!entry) {
      throw new NotFoundException({
        error: 'DRAFT_NOT_FOUND',
        message: 'Draft not found in this upload batch',
      });
    }

    // The draft's own period must be writable (a corrected repost's period may
    // differ from the ingestion period).
    await this.periods.assertWritable(orgId, entry.periodId);

    // Validate all accounts up front so the patch applies wholly or not at all.
    const uniqueCodes = Array.from(new Set(args.lineAccounts.map((a) => a.accountCode.trim())));
    for (const code of uniqueCodes) {
      if (!code) {
        throw new BadRequestException({
          error: 'EMPTY_ACCOUNT',
          message: 'An account code was empty.',
        });
      }
      const hit = await this.chartModel
        .findOne({ organizationId: orgId, code, isActive: true })
        .lean();
      if (!hit) {
        throw new BadRequestException({
          error: 'UNKNOWN_ACCOUNT',
          message: `Account ${code} not found in this organization's chart`,
        });
      }
    }

    const lines = await this.lineModel.find({ entryId: entry._id });
    const lineById = new Map(lines.map((l) => [l._id.toString(), l]));
    const isVatAccount = (code: string): boolean =>
      code === INVOICE_VAT_ACCOUNTS.INPUT || code === INVOICE_VAT_ACCOUNTS.OUTPUT;

    for (const { lineId, accountCode } of args.lineAccounts) {
      const line = lineById.get(lineId);
      if (!line) {
        throw new BadRequestException({
          error: 'LINE_NOT_FOUND',
          message: `Line ${lineId} does not belong to this draft`,
        });
      }
      // Guard: only operator legs are settable.
      if (line.counterpartyId || isVatAccount(line.accountCode)) {
        throw new BadRequestException({
          error: 'NOT_AN_OPERATOR_LINE',
          message:
            'Only invoice-line accounts can be set; the counterparty and VAT legs are fixed.',
        });
      }
      line.accountCode = accountCode.trim();
      await line.save();
    }

    this.logger.logAction('ledger.invoice.draft_edited', {
      orgId: orgId.toString(),
      periodId: entry.periodId.toString(),
      uploadId: args.uploadId,
      entryId: entry._id.toString(),
      actor: args.actor._id.toString(),
      linesSet: args.lineAccounts.length,
    });

    return entry;
  }

  // ─── Commit ────────────────────────────────────────────────────────────────

  async commitDrafts(args: CommitInvoiceArgs): Promise<{
    committed: number;
    skipped: number;
    reversed: number;
    rolledUpKeys: number;
  }> {
    const orgId = this.oid(args.organizationId);

    // Drafts of this upload across ALL periods — a corrected repost lives in the
    // ORIGINAL invoice's period, which may differ from the ingestion period, so
    // the batch is keyed by uploadId, not by a single period.
    const drafts = await this.entryModel.find({
      organizationId: orgId,
      source: 'manual',
      status: 'draft',
      sourceRef: { $regex: `^invoice:${this.escapeRegex(args.uploadId)}:` },
    });

    let committed = 0;
    let skipped = 0;
    let reversed = 0;
    const touched: JournalEntryDocument[] = [];
    const now = new Date();
    const writable = new Map<string, boolean>();

    for (const draft of drafts) {
      // RED — an operator leg still on the placeholder '000'. Skip rather than
      // half-fail the batch; the operator picks the accounts and commits again.
      const lines = await this.lineModel.find({ entryId: draft._id }).lean();
      if (lines.some((l) => l.accountCode === UNRESOLVED_ACCOUNT)) {
        skipped++;
        continue;
      }

      // The draft's own period must be open. A corrected repost targets the
      // original's period; if the accountant has deliberately closed it, skip —
      // they reopen it (audited super_admin path) and commit again. Checked
      // without throwing so one locked period doesn't abort the whole batch.
      const pid = draft.periodId.toString();
      let open = writable.get(pid);
      if (open === undefined) {
        const period = await this.periodModel.findById(draft.periodId).lean();
        open = !!period && period.status === 'open';
        writable.set(pid, open);
      }
      if (!open) {
        skipped++;
        continue;
      }

      // Corrected repost — reverse the original first (append-only), then commit
      // the repost. Both sit in the original's period dated to the original СФ,
      // so that period nets to exactly the corrected figures (§7.5).
      if (draft.correctsEntryId) {
        const original = await this.entryModel.findById(draft.correctsEntryId);
        if (original && original.status === 'committed') {
          const reversal = await this.createReversingEntry(original, args.actor);
          if (reversal) {
            touched.push(reversal);
            reversed++;
          }
        }
      }

      draft.status = 'committed';
      draft.committedAt = now;
      draft.committedBy = args.actor._id;
      await draft.save();
      touched.push(draft);
      committed++;
    }

    // Materialize AccountBalance rows for every key the committed batch touched
    // — same rollup the bank engine uses. For corrected invoices the reversing
    // entry shares the original's keys, so passing it recomputes those balances
    // and the original (+X) and reversal (-X) net out, leaving the repost.
    const rollup = await this.balanceRollup.rollupForEntries(touched);

    this.logger.logAction('ledger.invoice.committed', {
      orgId: orgId.toString(),
      uploadId: args.uploadId,
      actor: args.actor._id.toString(),
      committed,
      skipped,
      reversed,
      rolledUpKeys: rollup.affectedKeys.length,
      rolledUpRecomputed: rollup.recomputed,
      rolledUpCreated: rollup.created,
    });

    return { committed, skipped, reversed, rolledUpKeys: rollup.affectedKeys.length };
  }

  /**
   * Reverse a committed entry, append-only (methodology §7.5 / the schema's
   * reversesEntryId contract): create a NEW committed entry with sign-flipped
   * legs (debit↔credit) and otherwise-identical accounts, amounts, subconto,
   * counterparty and document, in the original's period dated to the original.
   *
   * The original is left at status 'committed' on purpose — the rollup sums
   * committed lines, so the original (+X) and this reversal (−X) net to zero;
   * flipping the original to 'reversed' would drop its +X and double-count.
   * `reversedAt`/`reversedBy` are stamped on the original as an audit marker.
   *
   * Idempotent: returns null if a reversal of this entry already exists, so a
   * re-commit after a partial batch doesn't reverse twice.
   */
  private async createReversingEntry(
    original: JournalEntryDocument,
    actor: UserDocument,
  ): Promise<JournalEntryDocument | null> {
    const already = await this.entryModel.findOne({
      reversesEntryId: original._id,
      status: 'committed',
    });
    if (already) return null;

    const now = new Date();
    const reversal = await this.entryModel.create({
      organizationId: original.organizationId,
      periodId: original.periodId,
      date: original.date,
      description: `Reversal of: ${original.description ?? ''}`.substring(0, 1990),
      source: 'manual',
      // Distinct prefix (not `invoice:{uploadId}:`) so the reversal is a
      // standalone ledger event — it posts to balances/the matrix correctly but
      // does not show up in the invoice batch/preview listings or counts. The
      // original's ref is embedded for provenance.
      sourceRef: original.sourceRef ? `invoice-reversal:${original.sourceRef}` : null,
      status: 'committed',
      totalAmount: original.totalAmount,
      createdBy: actor._id,
      committedAt: now,
      committedBy: actor._id,
      reversesEntryId: original._id,
    });

    const originalLines = await this.lineModel.find({ entryId: original._id }).lean();
    const flipped = originalLines.map((l) => ({
      entryId: reversal._id,
      organizationId: l.organizationId,
      periodId: l.periodId,
      date: l.date,
      accountCode: l.accountCode,
      direction: l.direction === 'debit' ? 'credit' : 'debit',
      amount: l.amount,
      counterpartyId: l.counterpartyId ?? null,
      subconto1Value: l.subconto1Value ?? null,
      subconto2Value: l.subconto2Value ?? null,
      subconto3Value: l.subconto3Value ?? null,
      documentType: l.documentType ?? null,
      documentId: l.documentId ?? null,
      description: l.description ?? null,
    }));
    await this.lineModel.create(flipped);

    original.reversedAt = now;
    original.reversedBy = actor._id;
    await original.save();

    return reversal;
  }

  // ─── List upload batches for a period (batch-history screen) ────────────────

  /**
   * Aggregate every invoice entry in a period into one row per upload batch.
   * As with the bank module there is no separate "upload" collection — each
   * upload's identity lives in the entries' `sourceRef`
   * (`invoice:{uploadId}:{rowIndex}`), so we group by the embedded uploadId.
   *
   * Per batch: total invoices, a per-status breakdown, the green/yellow/red
   * breakdown of the still-draft invoices, and the earliest createdAt.
   */
  async listBatchesForPeriod(args: {
    organizationId: Types.ObjectId | string;
    periodId: Types.ObjectId | string;
  }): Promise<
    Array<{
      uploadId: string;
      uploadedAt: Date | null;
      totalInvoices: number;
      statusCounts: Record<JournalEntryStatus, number>;
      draftColorCounts: Record<InvoicePreviewColor, number>;
    }>
  > {
    const orgId = this.oid(args.organizationId);
    const periodId = this.oid(args.periodId);

    const entries = await this.entryModel
      .find({
        organizationId: orgId,
        periodId,
        source: 'manual',
        sourceRef: { $regex: '^invoice:' },
      })
      .select('_id sourceRef status createdAt')
      .lean();

    if (entries.length === 0) return [];

    // entryId → has an unset operator leg ('000' placeholder) → RED. One query.
    const entryIds = entries.map((e) => e._id);
    const placeholderLines = await this.lineModel
      .find({ entryId: { $in: entryIds }, accountCode: UNRESOLVED_ACCOUNT })
      .select('entryId')
      .lean();
    const redEntryIds = new Set(placeholderLines.map((l) => l.entryId.toString()));

    // Auto-created counterparty (YELLOW) for the remaining draft invoices.
    const draftLineEntryIds = entries
      .filter((e) => e.status === 'draft' && !redEntryIds.has(e._id.toString()))
      .map((e) => e._id);
    const draftLines =
      draftLineEntryIds.length > 0
        ? await this.lineModel
            .find({ entryId: { $in: draftLineEntryIds }, counterpartyId: { $ne: null } })
            .select('entryId counterpartyId')
            .lean()
        : [];
    const cpartyIds = Array.from(
      new Set(
        draftLines
          .map((l) => l.counterpartyId?.toString())
          .filter((id): id is string => typeof id === 'string'),
      ),
    );
    const autoCreatedCparties =
      cpartyIds.length > 0
        ? await this.counterpartyModel
            .find({
              _id: { $in: cpartyIds.map((id) => new Types.ObjectId(id)) },
              createdFromBankRow: true,
            })
            .select('_id')
            .lean()
        : [];
    const autoCreatedSet = new Set(autoCreatedCparties.map((c) => c._id.toString()));
    const yellowEntryIds = new Set<string>();
    for (const line of draftLines) {
      const cpId = line.counterpartyId?.toString();
      if (cpId && autoCreatedSet.has(cpId)) yellowEntryIds.add(line.entryId.toString());
    }

    const batches = new Map<
      string,
      {
        uploadId: string;
        uploadedAt: Date | null;
        totalInvoices: number;
        statusCounts: Record<JournalEntryStatus, number>;
        draftColorCounts: Record<InvoicePreviewColor, number>;
      }
    >();

    for (const e of entries) {
      const ref = e.sourceRef ?? '';
      const parts = ref.split(':'); // ['invoice', uploadId, rowIndex]
      const uploadId = parts[1];
      if (!uploadId) continue;

      let batch = batches.get(uploadId);
      if (!batch) {
        batch = {
          uploadId,
          uploadedAt: null,
          totalInvoices: 0,
          statusCounts: { draft: 0, committed: 0, reversed: 0 },
          draftColorCounts: { green: 0, yellow: 0, red: 0 },
        };
        batches.set(uploadId, batch);
      }

      batch.totalInvoices += 1;
      batch.statusCounts[e.status] = (batch.statusCounts[e.status] ?? 0) + 1;

      const created = (e as unknown as { createdAt?: Date }).createdAt ?? null;
      if (created && (!batch.uploadedAt || created < batch.uploadedAt)) {
        batch.uploadedAt = created;
      }

      if (e.status === 'draft') {
        const id = e._id.toString();
        if (redEntryIds.has(id)) batch.draftColorCounts.red += 1;
        else if (yellowEntryIds.has(id)) batch.draftColorCounts.yellow += 1;
        else batch.draftColorCounts.green += 1;
      }
    }

    return Array.from(batches.values()).sort((a, b) => {
      const at = a.uploadedAt ? a.uploadedAt.getTime() : 0;
      const bt = b.uploadedAt ? b.uploadedAt.getTime() : 0;
      return bt - at;
    });
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private oid(v: Types.ObjectId | string): Types.ObjectId {
    return typeof v === 'string' ? new Types.ObjectId(v) : v;
  }

  /** Short, human label for an operator line in the preview (ИКПУ-based). */
  private lineLabel(ikpuCode: string | null, ikpuName: string | null): string {
    const code = ikpuCode ? `${ikpuCode} ` : '';
    const name = ikpuName ?? 'Line';
    return `${code}${name}`.substring(0, 1000);
  }

  private escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
