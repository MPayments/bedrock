import type { Logger } from "@bedrock/platform/observability/logger";
import {
  createModuleRuntime,
  type Clock,
  type UuidGenerator,
} from "@bedrock/shared/core";

import { createFeesService } from "./fees/application";
import type { FeeRuleRepository } from "./fees/application/ports";
import { createTreasuryInstructionsService } from "./instructions/application";
import type { TreasuryInstructionArtifactsRepository } from "./instructions/application/ports/artifacts.repository";
import type { TreasuryInstructionsRepository } from "./instructions/application/ports/instructions.repository";
import { createTreasuryOperationsService } from "./operations/application";
import type { TreasuryOperationsRepository } from "./operations/application/ports/operations.repository";
import { createPaymentRoutesService } from "./payment-routes/application";
import type { PaymentRouteTemplatesRepository } from "./payment-routes/application/ports/payment-routes.repository";
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

export type TreasuryModuleUnitOfWork = QuotesCommandUnitOfWork;

export interface TreasuryModuleDeps {
  logger: Logger;
  now: Clock;
  generateUuid: UuidGenerator;
  currencies: CurrenciesPort;
  instructionArtifactsRepository: TreasuryInstructionArtifactsRepository;
  instructionsRepository: TreasuryInstructionsRepository;
  operationsRepository: TreasuryOperationsRepository;
  ratesRepository: RatesRepository;
  quotesRepository: QuotesRepository;
  quoteFeeComponentsRepository: QuoteFeeComponentsRepository;
  quoteFinancialLinesRepository: QuoteFinancialLinesRepository;
  feeRulesRepository: FeeRuleRepository;
  paymentRouteTemplatesRepository: PaymentRouteTemplatesRepository;
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

  return {
    instructions: createTreasuryInstructionsService({
      artifactsRepository: deps.instructionArtifactsRepository,
      instructionsRepository: deps.instructionsRepository,
      operationsRepository: deps.operationsRepository,
      runtime: createRuntime("treasury.instructions"),
    }),
    operations: createTreasuryOperationsService({
      operationsRepository: deps.operationsRepository,
      runtime: createRuntime("treasury.operations"),
    }),
    rates,
    quotes: createQuotesService({
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
    }),
    paymentRoutes,
    fees,
  };
}
