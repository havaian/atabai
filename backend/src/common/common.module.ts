import { Global, Module } from '@nestjs/common';

import { AllExceptionsFilter } from './filters/all-exceptions.filter';

/**
 * Cross-cutting concerns shared by every feature module.
 *
 * Marked global so providers exposed here (filter, future interceptors) are
 * injectable without re-importing CommonModule everywhere.
 */
@Global()
@Module({
  providers: [AllExceptionsFilter],
  exports: [AllExceptionsFilter],
})
export class CommonModule {}
