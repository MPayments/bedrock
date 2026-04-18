import { randomUUID } from "node:crypto";

import type { IdempotencyPort } from "@bedrock/platform/idempotency";
import type { Logger } from "@bedrock/platform/observability/logger";
import {
  createPersistenceContext,
  type Database,
  type PersistenceContext,
  type Queryable,
  type Transaction,
} from "@bedrock/platform/persistence";

import {
  createLedgerModule,
  type LedgerModule,
  type LedgerModuleDeps,
} from "../../module";
import { DrizzleBalancesReads } from "../../balances/adapters/drizzle/balances.reads";
import { DrizzleBooksReads } from "../../books/adapters/drizzle/book.reads";
import { DrizzleOperationsReads } from "../../operations/adapters/drizzle/operations.reads";
import { DrizzleLedgerReportsReads } from "../../reports/adapters/drizzle/reports.reads";
import { DrizzleLedgerUnitOfWork } from "../../shared/adapters/drizzle/ledger.uow";

export interface LedgerReadRuntime {
  balancesQueries: DrizzleBalancesReads;
  booksQueries: DrizzleBooksReads;
  operationsQueries: DrizzleOperationsReads;
  reportsQueries: DrizzleLedgerReportsReads;
}

export interface CreateLedgerModuleFromDrizzleInput {
  assertInternalLedgerBooks?: LedgerModuleDeps["assertInternalLedgerBooks"];
  db: Database | Transaction;
  generateUuid?: LedgerModuleDeps["generateUuid"];
  idempotency: IdempotencyPort;
  logger: Logger;
  now?: LedgerModuleDeps["now"];
  persistence?: PersistenceContext;
}

export function createLedgerReadRuntimeFromDrizzle(
  database: Queryable,
): LedgerReadRuntime {
  return {
    balancesQueries: new DrizzleBalancesReads(database),
    booksQueries: new DrizzleBooksReads(database),
    operationsQueries: new DrizzleOperationsReads(database),
    reportsQueries: new DrizzleLedgerReportsReads(database),
  };
}

export function createLedgerModuleFromDrizzle(
  input: CreateLedgerModuleFromDrizzleInput,
): LedgerModule {
  const persistence =
    input.persistence ?? createPersistenceContext(input.db as Database);

  return createLedgerModule({
    balancesReads: new DrizzleBalancesReads(input.db),
    booksReads: new DrizzleBooksReads(input.db),
    generateUuid: input.generateUuid ?? randomUUID,
    logger: input.logger,
    now: input.now ?? (() => new Date()),
    operationsReads: new DrizzleOperationsReads(input.db),
    reportsReads: new DrizzleLedgerReportsReads(input.db),
    ...(input.assertInternalLedgerBooks
      ? {
          assertInternalLedgerBooks: input.assertInternalLedgerBooks,
        }
      : {}),
    unitOfWork: new DrizzleLedgerUnitOfWork({
      idempotency: input.idempotency,
      persistence,
    }),
  });
}
