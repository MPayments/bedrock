import type { Logger } from "@bedrock/platform/observability/logger";
import {
  createModuleRuntime,
  type Clock,
  type UuidGenerator,
} from "@bedrock/shared/core";

import { createFeesService } from "./fees/application";
import type { FeeRuleRepository } from "./fees/application/ports";
import { createPaymentRoutesService } from "./payment-routes/application";
import type { PaymentRouteTemplatesRepository } from "./payment-routes/application/ports/payment-routes.repository";
import { createPaymentStepsService } from "./payment-steps/application";
import type { PaymentStepsRepository } from "./payment-steps/application/ports/payment-steps.repository";
import { createQuoteExecutionsService } from "./quote-executions/application";
import type { QuoteExecutionsRepository } from "./quote-executions/application/ports/quote-executions.repository";
import { createQuotesService } from "./quotes/application";
import type {
  QuoteFeeComponentsRepository,
  QuoteFinancialLinesRepository,
  QuotesCommandUnitOfWork,
  QuotesRepository,
} from "./quotes/application/ports";
import { createRatesService } from "./rates/application";
import type { RatesRepository } from "./rates/application/ports";
import type {
  CurrenciesPort,
  RateSource,
  RateSourceProvider,
} from "./shared/application/external-ports";
import { createTreasuryOrdersService } from "./treasury-orders/application";
import type { TreasuryOrdersRepository } from "./treasury-orders/application/ports/treasury-orders.repository";

export type TreasuryModuleUnitOfWork = QuotesCommandUnitOfWork;

export interface TreasuryModuleDeps {
  logger: Logger;
  now: Clock;
  generateUuid: UuidGenerator;
  currencies: CurrenciesPort;
  ratesRepository: RatesRepository;
  quotesRepository: QuotesRepository;
  quoteFeeComponentsRepository: QuoteFeeComponentsRepository;
  quoteFinancialLinesRepository: QuoteFinancialLinesRepository;
  feeRulesRepository: FeeRuleRepository;
  paymentRouteTemplatesRepository: PaymentRouteTemplatesRepository;
  paymentStepsRepository: PaymentStepsRepository;
  quoteExecutionsRepository: QuoteExecutionsRepository;
  treasuryOrdersRepository: TreasuryOrdersRepository;
  unitOfWork: TreasuryModuleUnitOfWork;
  rateSourceProviders?: Partial<Record<RateSource, RateSourceProvider>>;
}

export type TreasuryModule = ReturnType<typeof createTreasuryModule>;

export function createTreasuryModule(deps: TreasuryModuleDeps) {
  const createRuntime = (service: string) =>
    createModuleRuntime({
      logger: deps.logger,
      now: deps.now,
      generateUuid: deps.generateUuid,
      service,
    });

  const fees = createFeesService({
    runtime: createRuntime("treasury.fees"),
    currencies: deps.currencies,
    rulesReads: deps.feeRulesRepository,
    rulesStore: deps.feeRulesRepository,
  });
  const rates = createRatesService({
    runtime: createRuntime("treasury.rates"),
    currencies: deps.currencies,
    rateSourceProviders: deps.rateSourceProviders,
    ratesRepository: deps.ratesRepository,
  });
  const paymentRoutes = createPaymentRoutesService({
    currencies: deps.currencies,
    repository: deps.paymentRouteTemplatesRepository,
    runtime: createRuntime("treasury.payment_routes"),
    getCrossRate: rates.queries.getCrossRate,
  });

  const paymentSteps = createPaymentStepsService({
    repository: deps.paymentStepsRepository,
    runtime: createRuntime("treasury.payment_steps"),
  });
  const quotes = createQuotesService({
    runtime: createRuntime("treasury.quotes"),
    currencies: deps.currencies,
    fees: {
      calculateQuoteFeeComponents: fees.queries.calculateQuoteFeeComponents,
    },
    quoteFeeComponentsRepository: deps.quoteFeeComponentsRepository,
    quoteFinancialLinesRepository: deps.quoteFinancialLinesRepository,
    quotesRepository: deps.quotesRepository,
    rates: {
      getCrossRate: rates.queries.getCrossRate,
    },
    commandUow: deps.unitOfWork,
  });
  const quoteExecutions = createQuoteExecutionsService({
    quotes: quotes.queries,
    repository: deps.quoteExecutionsRepository,
    runtime: createRuntime("treasury.quote_executions"),
  });

  return {
    paymentSteps,
    quoteExecutions,
    treasuryOrders: createTreasuryOrdersService({
      paymentSteps,
      quoteExecutions,
      repository: deps.treasuryOrdersRepository,
      runtime: createRuntime("treasury.orders"),
    }),
    rates,
    quotes,
    paymentRoutes,
    fees,
  };
}
