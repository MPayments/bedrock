import { randomUUID } from "node:crypto";

import type { Logger } from "@bedrock/platform/observability/logger";
import {
  createPersistenceContext,
  type Database,
  type PersistenceContext,
} from "@bedrock/platform/persistence";
import {
  createTreasuryModule,
  type TreasuryModule,
  type TreasuryModuleDeps,
} from "@bedrock/treasury";
import {
  DrizzlePaymentRouteTemplatesRepository,
  DrizzlePaymentStepsRepository,
  DrizzleTreasuryFeeRulesRepository,
  DrizzleTreasuryQuoteFeeComponentsRepository,
  DrizzleTreasuryQuoteFinancialLinesRepository,
  DrizzleTreasuryQuotesRepository,
  DrizzleTreasuryRatesRepository,
  DrizzleTreasuryUnitOfWork,
} from "@bedrock/treasury/adapters/drizzle";
import { createDefaultRateSourceProviders } from "@bedrock/treasury/providers";

export function createApiTreasuryModule(input: {
  db: Database;
  logger: Logger;
  currencies: TreasuryModuleDeps["currencies"];
  now?: TreasuryModuleDeps["now"];
  generateUuid?: TreasuryModuleDeps["generateUuid"];
  persistence?: PersistenceContext;
}): TreasuryModule {
  const persistence = input.persistence ?? createPersistenceContext(input.db);

  return createTreasuryModule({
    logger: input.logger,
    now: input.now ?? (() => new Date()),
    generateUuid: input.generateUuid ?? randomUUID,
    currencies: input.currencies,
    ratesRepository: new DrizzleTreasuryRatesRepository(input.db),
    quotesRepository: new DrizzleTreasuryQuotesRepository(input.db),
    quoteFinancialLinesRepository:
      new DrizzleTreasuryQuoteFinancialLinesRepository(input.db),
    quoteFeeComponentsRepository:
      new DrizzleTreasuryQuoteFeeComponentsRepository(input.db),
    feeRulesRepository: new DrizzleTreasuryFeeRulesRepository(input.db),
    paymentRouteTemplatesRepository:
      new DrizzlePaymentRouteTemplatesRepository(input.db),
    paymentStepsRepository: new DrizzlePaymentStepsRepository(input.db),
    unitOfWork: new DrizzleTreasuryUnitOfWork({ persistence }),
    rateSourceProviders: createDefaultRateSourceProviders(),
  });
}
