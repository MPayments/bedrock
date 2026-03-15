import type { Logger } from "@bedrock/platform/observability/logger";
import type { Database } from "@bedrock/platform/persistence/drizzle";

import { createFxQuoteCommandHandlers } from "./application/quotes/commands";
import { createFxQuoteQueryHandlers } from "./application/quotes/queries";
import { createFxRateCommandHandlers } from "./application/rates/commands";
import { createRateQueryHandlers } from "./application/rates/queries";
import type {
  FxCurrenciesPort,
  FxQuoteFeesPort,
  FxRateSource,
  FxRateSourceProvider,
} from "./application/ports";
import { createFxServiceContext } from "./application/shared/context";
import { createDrizzleFxQuoteFinancialLinesRepository } from "./infra/drizzle/repos/quote-financial-lines-repository";
import { createDrizzleFxQuotesRepository } from "./infra/drizzle/repos/quotes-repository";
import { createDrizzleFxRatesRepository } from "./infra/drizzle/repos/rates-repository";

export interface FxServiceDeps {
  db: Database;
  feesService: FxQuoteFeesPort;
  currenciesService: FxCurrenciesPort;
  logger?: Logger;
  rateSourceProviders?: Partial<Record<FxRateSource, FxRateSourceProvider>>;
}

export function createFxService(deps: FxServiceDeps) {
  const quotesRepository = createDrizzleFxQuotesRepository(deps.db);
  const ratesRepository = createDrizzleFxRatesRepository(deps.db);
  const quoteFinancialLinesRepository =
    createDrizzleFxQuoteFinancialLinesRepository(deps.db);

  const context = createFxServiceContext({
    feesService: deps.feesService,
    currenciesService: deps.currenciesService,
    quotesRepository,
    ratesRepository,
    quoteFinancialLinesRepository,
    transactions: {
      runInTransaction: (callback) =>
        deps.db.transaction((tx) => callback(tx as any)),
    },
    logger: deps.logger,
    rateSourceProviders: deps.rateSourceProviders,
  });

  const rateCommands = createFxRateCommandHandlers(context);
  const rateQueries = createRateQueryHandlers(context, {
    ensureSourceFresh: rateCommands.ensureSourceFresh,
    getLatestManualRate: rateCommands.getLatestManualRate,
    getLatestRateBySource: rateCommands.getLatestRateBySource,
    getRateSourceStatuses: rateCommands.getRateSourceStatuses,
  });
  const quoteQueries = createFxQuoteQueryHandlers(context);
  const quoteCommands = createFxQuoteCommandHandlers(context, {
    getCrossRate: rateQueries.getCrossRate,
    withQuoteCurrencyCodes: quoteQueries.withQuoteCurrencyCodes,
  });

  return {
    setManualRate: rateCommands.setManualRate,
    syncRatesFromSource: rateCommands.syncRatesFromSource,
    expireOldQuotes: rateCommands.expireOldQuotes,
    getLatestRate: rateQueries.getLatestRate,
    getCrossRate: rateQueries.getCrossRate,
    listPairs: rateQueries.listPairs,
    getRateHistory: rateQueries.getRateHistory,
    getRateSourceStatuses: rateQueries.getRateSourceStatuses,
    quote: quoteCommands.quote,
    listQuotes: quoteQueries.listQuotes,
    getQuoteDetails: quoteQueries.getQuoteDetails,
    markQuoteUsed: quoteCommands.markQuoteUsed,
  };
}

export type FxService = ReturnType<typeof createFxService>;
