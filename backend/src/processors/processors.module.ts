import { Global, Module } from '@nestjs/common';

import { PROCESSOR_SERVICE } from './processor.interface';
import { ProcessorDispatcherService } from './processor-dispatcher.service';

/**
 * Owns the processor pipeline. PROCESSOR_SERVICE resolves to the dispatcher
 * which routes each upload to the right per-template processor (balance
 * sheet, cash flow, P&L, P&L Form 2, equity).
 *
 * The per-template processor functions are plain modules (pure pipelines —
 * extractor → transformer → styler) so this module only registers the
 * dispatcher seam.
 *
 * Marked global so any module (files, admin) can inject PROCESSOR_SERVICE
 * without re-importing.
 */
@Global()
@Module({
  providers: [
    ProcessorDispatcherService,
    {
      provide: PROCESSOR_SERVICE,
      useExisting: ProcessorDispatcherService,
    },
  ],
  exports: [PROCESSOR_SERVICE],
})
export class ProcessorsModule {}
