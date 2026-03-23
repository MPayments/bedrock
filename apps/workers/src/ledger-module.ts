import { randomUUID } from "node:crypto";

import {
  createLedgerModule,
  type LedgerModule,
  type LedgerModuleDeps,
} from "@bedrock/ledger";
import {
  DrizzleBalancesReads,
  DrizzleBooksReads,
  DrizzleLedgerReportsReads,
  DrizzleLedgerUnitOfWork,
  DrizzleOperationsReads,
} from "@bedrock/ledger/adapters/drizzle";
import type { IdempotencyPort } from "@bedrock/platform/idempotency";
import type { Logger } from "@bedrock/platform/observability/logger";
import {
  createPersistenceContext,
  type Database,
  type PersistenceContext,
  type Transaction,
} from "@bedrock/platform/persistence";

import { createWorkerPartiesReadRuntime } from "./parties-module";

export function createWorkerLedgerModule(input: {
  db: Database | Transaction;
  idempotency: IdempotencyPort;
  logger: Logger;
  now?: LedgerModuleDeps["now"];
  generateUuid?: LedgerModuleDeps["generateUuid"];
  persistence?: PersistenceContext;
}): LedgerModule {
  const persistence =
    input.persistence ?? createPersistenceContext(input.db as Database);
  const { organizationsQueries } = createWorkerPartiesReadRuntime(input.db);

  return createLedgerModule({
    logger: input.logger,
    now: input.now ?? (() => new Date()),
    generateUuid: input.generateUuid ?? randomUUID,
    operationsReads: new DrizzleOperationsReads(input.db),
    booksReads: new DrizzleBooksReads(input.db),
    balancesReads: new DrizzleBalancesReads(input.db),
    reportsReads: new DrizzleLedgerReportsReads(input.db),
    unitOfWork: new DrizzleLedgerUnitOfWork({
      persistence,
      idempotency: input.idempotency,
    }),
    assertInternalLedgerBooks: ({ bookIds }) =>
      organizationsQueries.assertBooksBelongToInternalLedgerOrganizations(
        bookIds,
      ),
  });
}

export function createWorkerLedgerReadRuntime(
  database: Database | Transaction,
) {
  return {
    operationsQueries: new DrizzleOperationsReads(database),
    booksQueries: new DrizzleBooksReads(database),
    balancesQueries: new DrizzleBalancesReads(database),
    reportsQueries: new DrizzleLedgerReportsReads(database),
  };
}
