/**
 * src/integrations/currencies/currencies.controller.ts
 *
 * Minimal HTTP surface so the Currencies module is usable once imported:
 * read cached/fetched rates and trigger a manual refresh. Rates are national
 * (org-agnostic), so only authentication is required. Mount is automatic when
 * CurrenciesModule is in the graph.
 */
import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrenciesService } from './currencies.service';

@Controller('currencies')
@UseGuards(JwtAuthGuard)
export class CurrenciesController {
  constructor(private readonly currencies: CurrenciesService) {}

  /** All rates for a date (default: latest). */
  @Get('rates')
  async rates(@Query('date') date?: string) {
    const rates = await this.currencies.getRatesForDate(date);
    return { success: true, date: date ?? null, rates };
  }

  /** One currency's rate for a date (default: latest). */
  @Get('rate/:ccy')
  async rate(@Param('ccy') ccy: string, @Query('date') date?: string) {
    const rate = await this.currencies.getRate(ccy, date);
    return { success: true, rate };
  }

  /** Fetch the latest set from the CBU and upsert (idempotent). */
  @Post('refresh')
  async refresh() {
    const result = await this.currencies.refreshLatest();
    return { success: true, ...result };
  }
}
