import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { MulterModule } from '@nestjs/platform-express';

import { AuthModule } from '../auth/auth.module';
import type { AppConfig } from '../config/configuration';
import { buildMulterOptions } from '../files/utils/multer-config';
import { OrganizationsModule } from '../organizations/organizations.module';
import { UsersModule } from '../users/users.module';
import { AdjustmentsController } from './adjustments/adjustments.controller';
import { AdjustmentsService } from './adjustments/adjustments.service';
import { BalancesController } from './balances/balances.controller';
import { MatrixController } from './balances/matrix.controller';
import { BankIngestionService } from './bank/bank-ingestion.service';
import { ChartController } from './chart/chart.controller';
import { PeriodsReadController } from './periods/periods.controller';
import { BankStatementsController } from './bank/bank-statements.controller';
import { CounterpartyResolverService } from './bank/counterparty-resolver.service';
import { RunningBalanceService } from './bank/running-balance.service';
import { TreasuryResolverService } from './bank/treasury-resolver.service';
import { OsvIngestionService } from './ingestion/osv-ingestion.service';
import { OnboardingController } from './onboarding.controller';
import { OsvImportsController } from './osv-imports.controller';
import {
  AccountBalance,
  AccountBalanceSchema,
} from './schemas/account-balance.schema';
import {
  ChartOfAccount,
  ChartOfAccountSchema,
} from './schemas/chart-of-account.schema';
import { Counterparty, CounterpartySchema } from './schemas/counterparty.schema';
import {
  JournalEntryLine,
  JournalEntryLineSchema,
} from './schemas/journal-entry-line.schema';
import {
  JournalEntry,
  JournalEntrySchema,
} from './schemas/journal-entry.schema';
import {
  OrganizationProfile,
  OrganizationProfileSchema,
} from './schemas/organization-profile.schema';
import {
  ReportingPeriod,
  ReportingPeriodSchema,
} from './schemas/reporting-period.schema';
import { TreasuryRule, TreasuryRuleSchema } from './schemas/treasury-rule.schema';
import { BalanceRollupService } from './services/balance-rollup.service';
import { ChartSeedService } from './services/chart-seed.service';
import { LedgerBootstrapService } from './services/ledger-bootstrap.service';
import { OrganizationProfilesService } from './services/organization-profiles.service';
import { PeriodsService } from './services/periods.service';

/**
 * Ledger spine — architecture doc §8.1.
 *
 * Owns every Mongoose model in the ledger layer, the seed + ingestion
 * services, the bootstrap orchestrator, and the bank posting engine
 * (architecture doc §8.2 / bank ТЗ §3–§7).
 *
 * Imports OrganizationsModule because the bootstrap delegates org+admin
 * creation to OrganizationsService. The reverse dep doesn't exist —
 * OrganizationsModule doesn't depend on ledger.
 *
 * Build order context (doc §9):
 *   1. Ledger spine + period model + ОСВ ingestion — DONE.
 *   2. Bank posting engine — DONE (this commit). Upload → drafts →
 *      preview → commit. Manual per-row edit + "add to rules" learning
 *      loop are deferred to a follow-up.
 *   3. Adjustments — next slice; writes JournalEntry/Line with
 *      layer='adjustment' + adjustmentMeta.
 *   4. Access spine — see OrganizationsModule (already shipped).
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: OrganizationProfile.name, schema: OrganizationProfileSchema },
      { name: ReportingPeriod.name, schema: ReportingPeriodSchema },
      { name: ChartOfAccount.name, schema: ChartOfAccountSchema },
      { name: Counterparty.name, schema: CounterpartySchema },
      { name: AccountBalance.name, schema: AccountBalanceSchema },
      { name: JournalEntry.name, schema: JournalEntrySchema },
      { name: JournalEntryLine.name, schema: JournalEntryLineSchema },
      { name: TreasuryRule.name, schema: TreasuryRuleSchema },
    ]),
    OrganizationsModule,
    AuthModule,
    // UsersModule is required because JwtAuthGuard (re-exported by AuthModule)
    // injects UsersService at construction time. AuthModule itself uses
    // forwardRef(UsersModule), so re-importing it here is the documented
    // NestJS pattern — same shape as FilesModule.
    UsersModule,
    MulterModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfig, true>) =>
        buildMulterOptions(configService),
    }),
  ],
  controllers: [
    OnboardingController,
    OsvImportsController,
    BankStatementsController,
    AdjustmentsController,
    PeriodsReadController,
    ChartController,
    BalancesController,
    MatrixController,
  ],
  providers: [
    ChartSeedService,
    PeriodsService,
    OrganizationProfilesService,
    BalanceRollupService,
    OsvIngestionService,
    LedgerBootstrapService,
    CounterpartyResolverService,
    TreasuryResolverService,
    RunningBalanceService,
    BankIngestionService,
    AdjustmentsService,
  ],
  exports: [
    MongooseModule,
    ChartSeedService,
    PeriodsService,
    OrganizationProfilesService,
    BalanceRollupService,
    OsvIngestionService,
    LedgerBootstrapService,
    BankIngestionService,
    AdjustmentsService,
  ],
})
export class LedgerModule {}
