import { randomUUID } from "node:crypto";

import type { CurrenciesService } from "@bedrock/currencies";
import type { IdempotencyPort } from "@bedrock/platform/idempotency";
import type { Logger } from "@bedrock/platform/observability/logger";
import {
  createPersistenceContext,
  type Database,
  type PersistenceContext,
  type Transaction,
} from "@bedrock/platform/persistence";

import { DrizzleCalculationReads } from "./calculation.reads";
import { DrizzleCalculationsUnitOfWork } from "./calculations.uow";
import {
  createCalculationsModule,
  type CalculationsModule,
  type CalculationsModuleDeps,
} from "../../module";
import { DrizzlePaymentRouteTemplatesRepository } from "../../route-templates/adapters/drizzle/payment-routes.repository";

export interface CreateCalculationsModuleFromDrizzleInput {
  currencies: Pick<CurrenciesService, "findById">;
  db: Database | Transaction;
  generateUuid?: CalculationsModuleDeps["generateUuid"];
  idempotency: IdempotencyPort;
  logger: Logger;
  now?: CalculationsModuleDeps["now"];
  persistence?: PersistenceContext;
  treasuryRates: {
    getCrossRate: CalculationsModuleDeps["getCrossRate"];
  };
  treasuryQuotes: {
    findById(id: string): Promise<{
      fromCurrencyId: string;
      id: string;
      rateDen: bigint;
      rateNum: bigint;
      toCurrencyId: string;
    } | null>;
  };
}

export function createCalculationsModuleFromDrizzle(
  input: CreateCalculationsModuleFromDrizzleInput,
): CalculationsModule {
  const persistence =
    input.persistence ?? createPersistenceContext(input.db as Database);

  return createCalculationsModule({
    commandUow: new DrizzleCalculationsUnitOfWork({ persistence }),
    currencies: input.currencies,
    generateUuid: input.generateUuid ?? randomUUID,
    getCrossRate: input.treasuryRates.getCrossRate.bind(input.treasuryRates),
    idempotency: input.idempotency,
    logger: input.logger,
    now: input.now ?? (() => new Date()),
    reads: new DrizzleCalculationReads(input.db),
    references: {
      assertCurrencyExists: async (id: string) => {
        await input.currencies.findById(id);
      },
      findFxQuoteById: input.treasuryQuotes.findById.bind(input.treasuryQuotes),
    },
    routeTemplatesRepository:
      new DrizzlePaymentRouteTemplatesRepository(input.db),
  });
}
