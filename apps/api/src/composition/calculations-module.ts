import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";


import {
  createCalculationsModule,
  type CalculationsModule,
  type CalculationsModuleDeps,
} from "@bedrock/calculations";
import {
  DrizzleCalculationReads,
  DrizzleCalculationsUnitOfWork,
} from "@bedrock/calculations/adapters/drizzle";
import type { CurrenciesService } from "@bedrock/currencies";
import type { IdempotencyPort } from "@bedrock/platform/idempotency";
import type { Logger } from "@bedrock/platform/observability/logger";
import {
  createPersistenceContext,
  type Database,
  type PersistenceContext,
} from "@bedrock/platform/persistence";
import { fxQuotes } from "@bedrock/treasury/schema";

export function createApiCalculationsModule(input: {
  currencies: Pick<CurrenciesService, "findById">;
  db: Database;
  generateUuid?: CalculationsModuleDeps["generateUuid"];
  idempotency: IdempotencyPort;
  logger: Logger;
  now?: CalculationsModuleDeps["now"];
  persistence?: PersistenceContext;
}): CalculationsModule {
  const persistence = input.persistence ?? createPersistenceContext(input.db);

  return createCalculationsModule({
    logger: input.logger,
    now: input.now ?? (() => new Date()),
    generateUuid: input.generateUuid ?? randomUUID,
    idempotency: input.idempotency,
    reads: new DrizzleCalculationReads(input.db),
    references: {
      async assertCurrencyExists(id: string) {
        await input.currencies.findById(id);
      },
      async findFxQuoteById(id: string) {
        const [row] = await input.db
          .select({
            id: fxQuotes.id,
            fromCurrencyId: fxQuotes.fromCurrencyId,
            toCurrencyId: fxQuotes.toCurrencyId,
            rateNum: fxQuotes.rateNum,
            rateDen: fxQuotes.rateDen,
          })
          .from(fxQuotes)
          .where(eq(fxQuotes.id, id))
          .limit(1);

        return row ?? null;
      },
    },
    commandUow: new DrizzleCalculationsUnitOfWork({ persistence }),
  });
}
