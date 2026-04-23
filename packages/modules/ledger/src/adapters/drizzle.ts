import { randomUUID } from "node:crypto";

import type { IdempotencyPort } from "@bedrock/platform/idempotency";
import type { Logger } from "@bedrock/platform/observability/logger";
import {
  createPersistenceContext,
  type Database,
  type PersistenceContext,
  type Transaction,
} from "@bedrock/platform/persistence";

import { DrizzleBalancesReads } from "../balances/adapters/drizzle/balances.reads";
import { DrizzleBooksReads } from "../books/adapters/drizzle/book.reads";
import {
  createLedgerModule,
  type LedgerModule,
  type LedgerModuleDeps,
} from "../module";
import { DrizzleOperationsReads } from "../operations/adapters/drizzle/operations.reads";
import { DrizzleLedgerReportsReads } from "../reports/adapters/drizzle/reports.reads";
import { DrizzleLedgerUnitOfWork } from "../shared/adapters/drizzle/ledger.uow";
import type { InternalLedgerBookGuard } from "../shared/application/internal-ledger-book-guard";

export { DrizzleBookAccountStore } from "../book-accounts/adapters/drizzle/book-account.store";
export { DrizzleBalancesProjectionRepository } from "../balances/adapters/drizzle/projection.repository";
export { DrizzleBalancesReads } from "../balances/adapters/drizzle/balances.reads";
export { DrizzleBalancesReportingRepository } from "../balances/adapters/drizzle/balance-reporting.repository";
export { DrizzleBalancesStateRepository } from "../balances/adapters/drizzle/balance-state.repository";
export { DrizzleBooksReads } from "../books/adapters/drizzle/book.reads";
export { DrizzleBooksStore } from "../books/adapters/drizzle/book.store";
export { DrizzleOperationsReads } from "../operations/adapters/drizzle/operations.reads";
export { DrizzleOperationsRepository } from "../operations/adapters/drizzle/operations.repository";
export { DrizzleLedgerReportsReads } from "../reports/adapters/drizzle/reports.reads";
export { DrizzleLedgerUnitOfWork } from "../shared/adapters/drizzle/ledger.uow";

export interface CreateDrizzleLedgerModuleInput {
  db: Database | Transaction;
  idempotency: IdempotencyPort;
  logger: Logger;
  assertInternalLedgerBooks?: InternalLedgerBookGuard;
  now?: LedgerModuleDeps["now"];
  generateUuid?: LedgerModuleDeps["generateUuid"];
  persistence?: PersistenceContext;
}

export function createDrizzleLedgerReadRuntime(
  database: Database | Transaction,
) {
  return {
    operationsQueries: new DrizzleOperationsReads(database),
    booksQueries: new DrizzleBooksReads(database),
    balancesQueries: new DrizzleBalancesReads(database),
    reportsQueries: new DrizzleLedgerReportsReads(database),
  };
}

export type DrizzleLedgerReadRuntime = ReturnType<
  typeof createDrizzleLedgerReadRuntime
>;

export function createDrizzleLedgerModule(
  input: CreateDrizzleLedgerModuleInput,
): LedgerModule {
  const persistence =
    input.persistence ?? createPersistenceContext(input.db as Database);

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
    ...(input.assertInternalLedgerBooks
      ? { assertInternalLedgerBooks: input.assertInternalLedgerBooks }
      : {}),
  });
}
