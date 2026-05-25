import { Injectable, NotImplementedException } from '@nestjs/common';

import type { TemplateType } from '../common/constants/template-types';
import { processBalanceSheetTemplate } from './balance-sheet.processor';
import { processCashFlowTemplate } from './cash-flow.processor';
import { processEquityTemplate } from './equity.processor';
import { processProfitLossTemplate } from './profit-loss.processor';
import { processProfitLossForm2Template } from './profit-loss-form2.processor';
import type { IProcessorService, ProcessorOptions, ProcessorResult } from './processor.interface';

/**
 * Dispatches a processing request to the right template processor. The
 * per-template processor functions are intentionally plain modules (not Nest
 * services) because they're pure pipelines — read → extract → transform →
 * style — with no DI needs. The dispatcher is the single Nest-bound seam
 * that satisfies the IProcessorService contract consumed by FilesService.
 */
@Injectable()
export class ProcessorDispatcherService implements IProcessorService {
  async process(
    templateType: TemplateType,
    filePath: string,
    options: ProcessorOptions,
  ): Promise<ProcessorResult> {
    switch (templateType) {
      // The per-template processor TS files use `@ts-nocheck` for their JS-port
      // bodies, so TS infers loose return types. We cast at the boundary — the
      // shape is verified at runtime by the controller / service consumers.
      case 'balanceSheet':
        return (await processBalanceSheetTemplate(filePath, options)) as unknown as ProcessorResult;
      case 'cashFlow':
        return (await processCashFlowTemplate(filePath, options)) as unknown as ProcessorResult;
      case 'profitLoss':
        return (await processProfitLossTemplate(filePath, options)) as unknown as ProcessorResult;
      case 'profitLossForm2':
        return (await processProfitLossForm2Template(filePath, options)) as unknown as ProcessorResult;
      case 'equity':
        return (await processEquityTemplate(filePath, options)) as unknown as ProcessorResult;
      default: {
        const exhaustive: never = templateType;
        throw new NotImplementedException({
          error: 'UNKNOWN_TEMPLATE',
          message: `No processor registered for template '${String(exhaustive)}'`,
        });
      }
    }
  }
}
