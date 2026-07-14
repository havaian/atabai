/**
 * src/integrations/currencies/currencies.module.ts
 *
 * Drop-in Currencies (CBU exchange-rate) module. Import it wherever the app
 * needs rates and inject CurrenciesService. It brings its own schema, HTTP
 * client and (opt-in) daily refresh job — no other wiring required.
 *
 * The scheduled refresh stays off until CURRENCIES_CRON_ENABLED=true.
 * ScheduleModule.forRoot() is already registered at the app root, so the @Cron
 * here is picked up automatically once this module is in the graph.
 */
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { CbuClient } from './cbu.client';
import { CurrenciesController } from './currencies.controller';
import { CurrenciesRefreshScheduler } from './currencies.cron';
import { CurrenciesService } from './currencies.service';
import { CurrencyRate, CurrencyRateSchema } from './schemas/currency-rate.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CurrencyRate.name, schema: CurrencyRateSchema },
    ]),
  ],
  controllers: [CurrenciesController],
  providers: [CbuClient, CurrenciesService, CurrenciesRefreshScheduler],
  exports: [CurrenciesService],
})
export class CurrenciesModule {}
