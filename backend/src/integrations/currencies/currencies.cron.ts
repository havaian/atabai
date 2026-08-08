/**
 * src/integrations/currencies/currencies.cron.ts
 *
 * Scheduled daily refresh of CBU rates. The job is registered whenever this
 * module is imported (ScheduleModule.forRoot() is already set up app-wide), but
 * it no-ops until CURRENCIES_CRON_ENABLED=true - so dropping the module into the
 * app never starts fetching on its own. The expression + timezone are read from
 * the environment at load time.
 */
import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { AppLoggerService } from '../../common/logger/app-logger.service';
import { CurrenciesService } from './currencies.service';
import { loadCurrenciesConfig, type CurrenciesConfig } from './currencies.config';

@Injectable()
export class CurrenciesRefreshScheduler {
  private readonly config: CurrenciesConfig = loadCurrenciesConfig();

  constructor(
    private readonly currencies: CurrenciesService,
    private readonly logger: AppLoggerService,
  ) {}

  @Cron(process.env.CURRENCIES_CRON || '0 6 * * *', {
    name: 'currencies-refresh',
    timeZone: process.env.CURRENCIES_CRON_TZ || 'Asia/Tashkent',
  })
  async handleDailyRefresh(): Promise<void> {
    if (!this.config.cronEnabled) return; // disabled until wired into the pipeline
    try {
      const result = await this.currencies.refreshLatest();
      this.logger.info(
        'Scheduled currencies refresh complete',
        result,
        'CurrenciesRefreshScheduler',
      );
    } catch (err) {
      this.logger.error(err, {}, 'CurrenciesRefreshScheduler');
    }
  }
}
