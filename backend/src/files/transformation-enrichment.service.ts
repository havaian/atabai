import { Injectable, Logger } from '@nestjs/common';

import type { TemplateType } from '../common/constants/template-types';

/**
 * Joins a stored transformation JSON with live mapping metadata at read time,
 * so mapping improvements apply retroactively without rewriting stored JSONs.
 *
 * Phase 5 ships a passthrough (cashFlow / equity already pass through in the
 * legacy code; balanceSheet / profitLossForm2 enrichment will be wired up in
 * Phase 7 alongside the MappingResolverService, once the mapping CRUD is
 * fully ported). A warning is emitted for the templates that need real
 * enrichment so we don't silently regress.
 */
@Injectable()
export class TransformationEnrichmentService {
  private readonly logger = new Logger(TransformationEnrichmentService.name);
  private readonly warnedTemplates = new Set<TemplateType>();

  enrich(templateType: TemplateType, transformationJson: Record<string, unknown>): Record<string, unknown> {
    switch (templateType) {
      case 'balanceSheet':
      case 'profitLossForm2':
        if (!this.warnedTemplates.has(templateType)) {
          this.warnedTemplates.add(templateType);
          this.logger.warn(
            `Transformation enrichment for '${templateType}' is passthrough until Phase 7 wires the mapping resolver — clients will see source rows without IFRS classification metadata.`,
          );
        }
        return transformationJson;
      case 'cashFlow':
      case 'equity':
      case 'profitLoss':
        // Already passthrough in the legacy code — section/columnKey are
        // already encoded directly on the source rows.
        return transformationJson;
      default: {
        const err = new Error(`Unknown template type: ${String(templateType)}`) as Error & {
          code?: string;
        };
        err.code = 'UNKNOWN_TEMPLATE';
        throw err;
      }
    }
  }
}
