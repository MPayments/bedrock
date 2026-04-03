import type { Logger } from "@bedrock/platform/observability/logger";
import type {
  Database,
  PersistenceContext,
} from "@bedrock/platform/persistence";
import { createModuleRuntime } from "@bedrock/shared/core";

import { DrizzleTreasuryOperationsRepository } from "../src/operations/adapters/drizzle/operations.repository";
import { createTreasuryOperationsService } from "../src/operations/application";
import { DrizzleTreasuryQuoteFeeComponentsRepository } from "../src/quotes/adapters/drizzle/quote-fee-components.repository";
import { DrizzleTreasuryQuoteFinancialLinesRepository } from "../src/quotes/adapters/drizzle/quote-financial-lines.repository";
import { DrizzleTreasuryQuotesRepository } from "../src/quotes/adapters/drizzle/quotes.repository";
import { createQuotesService } from "../src/quotes/application";
import { DrizzleTreasuryRatesRepository } from "../src/rates/adapters/drizzle/rates.repository";
import { createRatesService } from "../src/rates/application";
import { DrizzleTreasuryUnitOfWork } from "../src/shared/adapters/drizzle/treasury.uow";
import type {
  CurrenciesPort,
  QuoteFeesPort,
  RateSource,
  RateSourceProvider,
} from "../src/shared/application/external-ports";

export interface TreasuryTestServiceDeps {
  persistence: PersistenceContext;
  feesService: QuoteFeesPort;
  currenciesService: CurrenciesPort;
  logger?: Logger;
  rateSourceProviders?: Partial<Record<RateSource, RateSourceProvider>>;
}

export function createTreasuryTestHarness(deps: TreasuryTestServiceDeps) {
  const db = deps.persistence.db as Database;
  const ratesRuntime = createModuleRuntime({
    logger: deps.logger,
    now: () => new Date(),
    service: "treasury.rates",
  });
  const quotesRuntime = createModuleRuntime({
    logger: deps.logger,
    now: () => new Date(),
    service: "treasury.quotes",
  });
  const operationsRuntime = createModuleRuntime({
    logger: deps.logger,
    now: () => new Date(),
    service: "treasury.operations",
  });
  const ratesRepository = new DrizzleTreasuryRatesRepository(db);
  const operationsRepository = new DrizzleTreasuryOperationsRepository(db);
  const quotesRepository = new DrizzleTreasuryQuotesRepository(db);
  const quoteFeeComponentsRepository =
    new DrizzleTreasuryQuoteFeeComponentsRepository(db);
  const quoteFinancialLinesRepository =
    new DrizzleTreasuryQuoteFinancialLinesRepository(db);

  const rates = createRatesService({
    runtime: ratesRuntime,
    currencies: deps.currenciesService,
    rateSourceProviders: deps.rateSourceProviders,
    ratesRepository,
  });
  const quotes = createQuotesService({
    runtime: quotesRuntime,
    currencies: deps.currenciesService,
    fees: deps.feesService,
    quoteFeeComponentsRepository,
    quoteFinancialLinesRepository,
    quotesRepository,
    rates: {
      getCrossRate: rates.queries.getCrossRate,
    },
    commandUow: new DrizzleTreasuryUnitOfWork({ persistence: deps.persistence }),
  });
  const operations = createTreasuryOperationsService({
    operationsRepository,
    runtime: operationsRuntime,
  });

  const treasuryModule = {
    operations,
    rates,
    quotes,
  };

  return {
    treasuryModule,
    service: {
      rates: {
        setManualRate: treasuryModule.rates.commands.setManualRate,
        syncRatesFromSource: treasuryModule.rates.commands.syncRatesFromSource,
        getLatestRate: treasuryModule.rates.queries.getLatestRate,
        getCrossRate: treasuryModule.rates.queries.getCrossRate,
        listPairs: treasuryModule.rates.queries.listPairs,
        getRateHistory: treasuryModule.rates.queries.getRateHistory,
        getRateSourceStatuses:
          treasuryModule.rates.queries.getRateSourceStatuses,
      },
      quotes: {
        previewQuote: treasuryModule.quotes.queries.previewQuote,
        quote: treasuryModule.quotes.commands.createQuote,
        listQuotes: treasuryModule.quotes.queries.listQuotes,
        getQuoteDetails: treasuryModule.quotes.queries.getQuoteDetails,
        markQuoteUsed: treasuryModule.quotes.commands.markQuoteUsed,
        expireOldQuotes: treasuryModule.quotes.commands.expireQuotes,
      },
      operations: {
        createOrGetPlanned:
          treasuryModule.operations.commands.createOrGetPlanned,
        findById: treasuryModule.operations.queries.findById,
      },
    },
  };
}

export function createTreasuryTestService(deps: TreasuryTestServiceDeps) {
  return createTreasuryTestHarness(deps).service;
}

export type TreasuryTestService = ReturnType<typeof createTreasuryTestService>;
