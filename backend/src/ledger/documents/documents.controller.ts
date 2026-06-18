import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Types } from 'mongoose';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { MEMBERSHIP_CAPABILITIES } from '../../organizations/constants/membership-capabilities';
import { RequireCapability } from '../../organizations/decorators/require-capability.decorator';
import { OrgMembershipGuard } from '../../organizations/guards/org-membership.guard';
import {
  CreateDocumentDto,
  DOCUMENT_KINDS,
  type DocumentKindDto,
  SuggestDocumentsDto,
} from './dto/document.dto';
import { DocumentsService } from './documents.service';

/**
 * Settlement documents (contracts / invoices) for a counterparty — methodology
 * §7. Counterparty-scoped under the ledger namespace.
 *
 *   GET  .../counterparties/:cpId/documents?kind=invoice
 *        — list the counterparty's documents of a kind (read).
 *   POST .../counterparties/:cpId/documents
 *        — create one (write). Used by the preview "create new" action.
 *   POST .../counterparties/:cpId/documents/suggest
 *        — recognize + match against a payment purpose (read-ish, but POST
 *          because it carries a purpose body). Drives the preview picker.
 *
 * Capability gate mirrors the rest of the ledger: read for listing/suggesting,
 * write for creating.
 */
@Controller('organizations/:orgId/ledger/counterparties/:cpId/documents')
@UseGuards(JwtAuthGuard, OrgMembershipGuard)
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  private oid(v: string): Types.ObjectId {
    return new Types.ObjectId(v);
  }

  @Get()
  @RequireCapability(MEMBERSHIP_CAPABILITIES.NSBU_BASE_READ)
  async list(
    @Param('orgId') orgId: string,
    @Param('cpId') cpId: string,
    @Query('kind') kind: DocumentKindDto,
  ) {
    const k = DOCUMENT_KINDS.includes(kind) ? kind : 'invoice';
    const docs = await this.documents.listForCounterparty(
      this.oid(orgId),
      this.oid(cpId),
      k,
    );
    return { documents: docs };
  }

  @Post()
  @RequireCapability(MEMBERSHIP_CAPABILITIES.NSBU_BASE_WRITE)
  async create(
    @Param('orgId') orgId: string,
    @Param('cpId') cpId: string,
    @Body() body: CreateDocumentDto,
  ) {
    const doc = await this.documents.create({
      organizationId: this.oid(orgId),
      counterpartyId: this.oid(cpId),
      kind: body.kind,
      number: body.number,
      date: body.date ? new Date(body.date) : null,
      description: body.description ?? null,
      amount: body.amount ?? null,
    });
    return { document: doc };
  }

  @Post('suggest')
  @RequireCapability(MEMBERSHIP_CAPABILITIES.NSBU_BASE_READ)
  async suggest(
    @Param('orgId') orgId: string,
    @Param('cpId') cpId: string,
    @Body() body: SuggestDocumentsDto,
  ) {
    const suggestion = await this.documents.suggestForPurpose(
      this.oid(orgId),
      this.oid(cpId),
      body.kind,
      body.purpose,
    );
    return suggestion;
  }
}
