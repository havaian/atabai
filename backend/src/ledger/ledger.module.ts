import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { MulterModule } from '@nestjs/platform-express';

import { AuthModule } from '../auth/auth.module';
import type { AppConfig } from '../config/configuration';
import { buildMulterOptions } from '../common/upload/multer-config';
import { CurrenciesModule } from '../integrations/currencies/currencies.module';
import { OrginfoModule } from '../integrations/orginfo/orginfo.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { UsersModule } from '../users/users.module';
import { BalancesController } from './balances/balances.controller';
import { OpeningBalancesController } from './balances/opening-balances.controller';
import { OpeningBalancesService } from './balances/opening-balances.service';
import { CounterpartiesController } from './counterparties/counterparties.controller';
import { BankIngestionService } from './bank/bank-ingestion.service';
import { ChartController } from './chart/chart.controller';
import { PeriodsReadController } from './periods/periods.controller';
import { BankStatementsController } from './bank/bank-statements.controller';
import { CounterpartyResolverService } from './bank/counterparty-resolver.service';
import { RunningBalanceService } from './bank/running-balance.service';
import { TreasuryResolverService } from './bank/treasury-resolver.service';
import { DocumentsController } from './documents/documents.controller';
import { DocumentsService } from './documents/documents.service';
import { InvoiceRegistryController } from './documents/invoice-registry.controller';
import { InvoiceIngestionService } from './documents/invoice-ingestion.service';
import { OnboardingController } from './onboarding.controller';
import { OrganizationProfileController } from './organization-profile.controller';
import { AccountBalance, AccountBalanceSchema } from './schemas/account-balance.schema';
import { ChartOfAccount, ChartOfAccountSchema } from './schemas/chart-of-account.schema';
import { Contract, ContractSchema } from './schemas/contract.schema';
import { Counterparty, CounterpartySchema } from './schemas/counterparty.schema';
import { Invoice, InvoiceSchema } from './schemas/invoice.schema';
import { JournalEntryLine, JournalEntryLineSchema } from './schemas/journal-entry-line.schema';
import { JournalEntry, JournalEntrySchema } from './schemas/journal-entry.schema';
import {
  BankUploadJob,
  BankUploadJobSchema,
} from './schemas/bank-upload-job.schema';
import {
  OrganizationProfile,
  OrganizationProfileSchema,
} from './schemas/organization-profile.schema';
import { ReportingPeriod, ReportingPeriodSchema } from './schemas/reporting-period.schema';
import { TreasuryRule, TreasuryRuleSchema } from './schemas/treasury-rule.schema';
import { BalanceRollupService } from './services/balance-rollup.service';
import { ChartSeedService } from './services/chart-seed.service';
import { LedgerBootstrapService } from './services/ledger-bootstrap.service';
import { OrganizationProfilesService } from './services/organization-profiles.service';
import { PeriodsService } from './services/periods.service';

/**
 * Ledger spine - bank-statement module.
 *
 * Owns the Mongoose models the bank engine reads/writes, the chart + period
 * seed services, the bootstrap orchestrator, and the bank posting engine
 * (bank ТЗ §3–§7): upload → parse → counterparty/treasury recognition →
 * Scenario А/Б postings → green/yellow/red preview → commit.
 *
 * Imports OrganizationsModule because the bootstrap delegates org+admin
 * creation to OrganizationsService. The reverse dep doesn't exist -
 * OrganizationsModule doesn't depend on ledger.
 *
 * Scope note: the IFRS transformation/methodology layers (OSV ingestion,
 * reclassification, adjustments, IFRS derivation, matrix view) have been
 * removed - only the bank-statement bookkeeping path remains. Balances are
 * materialized purely from committed postings via BalanceRollupService.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: OrganizationProfile.name, schema: OrganizationProfileSchema },
      { name: ReportingPeriod.name, schema: ReportingPeriodSchema },
      { name: ChartOfAccount.name, schema: ChartOfAccountSchema },
      { name: Counterparty.name, schema: CounterpartySchema },
      { name: Contract.name, schema: ContractSchema },
      { name: Invoice.name, schema: InvoiceSchema },
      { name: AccountBalance.name, schema: AccountBalanceSchema },
      { name: JournalEntry.name, schema: JournalEntrySchema },
      { name: JournalEntryLine.name, schema: JournalEntryLineSchema },
      { name: TreasuryRule.name, schema: TreasuryRuleSchema },
      { name: BankUploadJob.name, schema: BankUploadJobSchema },
    ]),
    OrganizationsModule,
    // Integration modules. OrginfoModule exports OrginfoService (used by the
    // profile controller's "заполнить по ИНН" lookup). CurrenciesModule brings
    // its own CBU rate controller + service (methodology дополнение §2/§3);
    // both are safe by default - no credentials → no network calls.
    OrginfoModule,
    CurrenciesModule,
    AuthModule,
    // UsersModule is required because JwtAuthGuard (re-exported by AuthModule)
    // injects UsersService at construction time. AuthModule itself uses
    // forwardRef(UsersModule), so re-importing it here is the documented
    // NestJS pattern - same shape as FilesModule.
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
    OrganizationProfileController,
    BankStatementsController,
    PeriodsReadController,
    ChartController,
    BalancesController,
    OpeningBalancesController,
    CounterpartiesController,
    DocumentsController,
    InvoiceRegistryController,
  ],
  providers: [
    ChartSeedService,
    PeriodsService,
    OrganizationProfilesService,
    BalanceRollupService,
    LedgerBootstrapService,
    CounterpartyResolverService,
    TreasuryResolverService,
    RunningBalanceService,
    DocumentsService,
    BankIngestionService,
    InvoiceIngestionService,
    OpeningBalancesService,
  ],
  exports: [
    MongooseModule,
    ChartSeedService,
    PeriodsService,
    OrganizationProfilesService,
    BalanceRollupService,
    LedgerBootstrapService,
    DocumentsService,
    BankIngestionService,
  ],
})
export class LedgerModule {}
