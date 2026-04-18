import { randomUUID } from "node:crypto";

import type { Logger } from "@bedrock/platform/observability/logger";
import {
  createPersistenceContext,
  type Database,
  type PersistenceContext,
  type Transaction,
} from "@bedrock/platform/persistence";

import {
  createTreasuryModule,
  type TreasuryModule,
  type TreasuryModuleDeps,
} from "../../module";
import { createDefaultRateSourceProviders } from "../../providers";
import { DrizzleTreasuryFeeRulesRepository } from "../../fees/adapters/drizzle/fee-rules.repository";
import { DrizzleTreasuryInstructionsRepository } from "../../instructions/adapters/drizzle/instructions.repository";
import { DrizzleTreasuryOperationsRepository } from "../../operations/adapters/drizzle/operations.repository";
import { DrizzleTreasuryQuoteFeeComponentsRepository } from "../../quotes/adapters/drizzle/quote-fee-components.repository";
import { DrizzleTreasuryQuoteFinancialLinesRepository } from "../../quotes/adapters/drizzle/quote-financial-lines.repository";
import { DrizzleTreasuryQuotesRepository } from "../../quotes/adapters/drizzle/quotes.repository";
import { DrizzleTreasuryRatesRepository } from "../../rates/adapters/drizzle/rates.repository";
import { DrizzleTreasuryUnitOfWork } from "../../shared/adapters/drizzle/treasury.uow";

export interface CreateTreasuryModuleFromDrizzleInput {
  currencies: TreasuryModuleDeps["currencies"];
  db: Database | Transaction;
  generateUuid?: TreasuryModuleDeps["generateUuid"];
  logger: Logger;
  now?: TreasuryModuleDeps["now"];
  persistence?: PersistenceContext;
}

export function createTreasuryModuleFromDrizzle(
  input: CreateTreasuryModuleFromDrizzleInput,
): TreasuryModule {
  const persistence =
    input.persistence ?? createPersistenceContext(input.db as Database);

  return createTreasuryModule({
    currencies: input.currencies,
    feeRulesRepository: new DrizzleTreasuryFeeRulesRepository(input.db),
    generateUuid: input.generateUuid ?? randomUUID,
    instructionsRepository: new DrizzleTreasuryInstructionsRepository(input.db),
    logger: input.logger,
    now: input.now ?? (() => new Date()),
    operationsRepository: new DrizzleTreasuryOperationsRepository(input.db),
    quoteFeeComponentsRepository:
      new DrizzleTreasuryQuoteFeeComponentsRepository(input.db),
    quoteFinancialLinesRepository:
      new DrizzleTreasuryQuoteFinancialLinesRepository(input.db),
    quotesRepository: new DrizzleTreasuryQuotesRepository(input.db),
    rateSourceProviders: createDefaultRateSourceProviders(),
    ratesRepository: new DrizzleTreasuryRatesRepository(input.db),
    unitOfWork: new DrizzleTreasuryUnitOfWork({ persistence }),
  });
}
