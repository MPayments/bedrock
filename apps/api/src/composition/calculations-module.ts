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
import type { TreasuryModule } from "@bedrock/treasury";

export function createApiCalculationsModule(input: {
  currencies: Pick<CurrenciesService, "findByCode" | "findById">;
  db: Database;
  generateUuid?: CalculationsModuleDeps["generateUuid"];
  idempotency: IdempotencyPort;
  logger: Logger;
  now?: CalculationsModuleDeps["now"];
  persistence?: PersistenceContext;
  treasuryQuotes: Pick<TreasuryModule["quotes"]["queries"], "findById">;
}): CalculationsModule {
  const persistence = input.persistence ?? createPersistenceContext(input.db);

  return createCalculationsModule({
    logger: input.logger,
    now: input.now ?? (() => new Date()),
    generateUuid: input.generateUuid ?? randomUUID,
    reads: new DrizzleCalculationReads(input.db),
    references: {
      async assertCurrencyExists(id: string) {
        await input.currencies.findById(id);
      },
      async findCurrencyByCode(code: string) {
        return input.currencies.findByCode(code);
      },
      async findFxQuoteById(id: string) {
        return input.treasuryQuotes.findById(id);
      },
    },
    commandUow: new DrizzleCalculationsUnitOfWork({
      idempotency: input.idempotency,
      persistence,
    }),
  });
}
