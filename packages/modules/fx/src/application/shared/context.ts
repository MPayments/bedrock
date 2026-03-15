import type { Logger } from "@bedrock/platform/observability/logger";

import type {
  FxCurrenciesPort,
  FxQuoteFeesPort,
  FxQuoteFinancialLinesRepositoryPort,
  FxQuotesRepositoryPort,
  FxRatesRepositoryPort,
  FxRateSource,
  FxRateSourceProvider,
  FxTransactionsPort,
} from "../ports";

const noopLogger = {
  trace() {},
  debug() {},
  info() {},
  warn() {},
  error() {},
  fatal() {},
  child() {
    return noopLogger as unknown as Logger;
  },
} as unknown as Logger;

export interface FxServiceContextDeps {
  feesService: FxQuoteFeesPort;
  currenciesService: FxCurrenciesPort;
  quotesRepository: FxQuotesRepositoryPort;
  ratesRepository: FxRatesRepositoryPort;
  quoteFinancialLinesRepository: FxQuoteFinancialLinesRepositoryPort;
  transactions: FxTransactionsPort;
  logger?: Logger;
  rateSourceProviders?: Partial<Record<FxRateSource, FxRateSourceProvider>>;
}

export interface FxServiceContext {
  feesService: FxQuoteFeesPort;
  currenciesService: FxCurrenciesPort;
  quotesRepository: FxQuotesRepositoryPort;
  ratesRepository: FxRatesRepositoryPort;
  quoteFinancialLinesRepository: FxQuoteFinancialLinesRepositoryPort;
  transactions: FxTransactionsPort;
  log: Logger;
  rateSourceProviders: Partial<Record<FxRateSource, FxRateSourceProvider>>;
}

export function createFxServiceContext(
  deps: FxServiceContextDeps,
): FxServiceContext {
  return {
    feesService: deps.feesService,
    currenciesService: deps.currenciesService,
    quotesRepository: deps.quotesRepository,
    ratesRepository: deps.ratesRepository,
    quoteFinancialLinesRepository: deps.quoteFinancialLinesRepository,
    transactions: deps.transactions,
    log: deps.logger?.child({ svc: "fx" }) ?? noopLogger,
    rateSourceProviders: deps.rateSourceProviders ?? {},
  };
}
