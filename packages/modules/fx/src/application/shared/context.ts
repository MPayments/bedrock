import {
  noopLogger,
  type Logger,
} from "@bedrock/platform/observability/logger";

import type {
  FxCurrenciesPort,
  FxQuoteFeesPort,
  FxRateSource,
  FxRateSourceProvider,
  FxTransactionsPort,
} from "./external-ports";
import type {
  FxQuoteFinancialLinesRepository,
  FxQuotesRepository,
} from "../quotes/ports";
import type { FxRatesRepository } from "../rates/ports";

export interface FxServiceContextDeps {
  feesService: FxQuoteFeesPort;
  currenciesService: FxCurrenciesPort;
  quotesRepository: FxQuotesRepository;
  ratesRepository: FxRatesRepository;
  quoteFinancialLinesRepository: FxQuoteFinancialLinesRepository;
  transactions: FxTransactionsPort;
  logger?: Logger;
  rateSourceProviders?: Partial<Record<FxRateSource, FxRateSourceProvider>>;
}

export interface FxServiceContext {
  feesService: FxQuoteFeesPort;
  currenciesService: FxCurrenciesPort;
  quotesRepository: FxQuotesRepository;
  ratesRepository: FxRatesRepository;
  quoteFinancialLinesRepository: FxQuoteFinancialLinesRepository;
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
