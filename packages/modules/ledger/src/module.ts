import type { Logger } from "@bedrock/platform/observability/logger";
import {
  createModuleRuntime,
  type Clock,
  type UuidGenerator,
} from "@bedrock/shared/core";

import { createBalancesService } from "./balances/application";
import type { LedgerBalancesReads } from "./balances/application/ports/balances.reads";
import type { BalancesCommandUnitOfWork } from "./balances/application/ports/balances.uow";
import { createBookAccountsService } from "./book-accounts/application";
import type { BookAccountsCommandUnitOfWork } from "./book-accounts/application/ports/book-accounts.uow";
import { createBooksService } from "./books/application";
import type { LedgerBooksReads } from "./books/application/ports/book.reads";
import type { BooksCommandUnitOfWork } from "./books/application/ports/books.uow";
import { createOperationsService } from "./operations/application";
import type { LedgerOperationsReads } from "./operations/application/ports/operations.reads";
import type { OperationsCommandUnitOfWork } from "./operations/application/ports/operations.uow";
import { createReportsService } from "./reports/application";
import type { LedgerReportsReads } from "./reports/application/ports/reports.reads";
import { TigerBeetleSettlementIdentityPolicy } from "./shared/adapters/tigerbeetle/identity-policy";
import type { InternalLedgerBookGuard } from "./shared/application/internal-ledger-book-guard";

export type LedgerModuleUnitOfWork = BookAccountsCommandUnitOfWork &
  BalancesCommandUnitOfWork &
  BooksCommandUnitOfWork &
  OperationsCommandUnitOfWork;

export interface LedgerModuleDeps {
  logger: Logger;
  now: Clock;
  generateUuid: UuidGenerator;
  operationsReads: LedgerOperationsReads;
  booksReads: LedgerBooksReads;
  balancesReads: LedgerBalancesReads;
  reportsReads: LedgerReportsReads;
  unitOfWork: LedgerModuleUnitOfWork;
  assertInternalLedgerBooks?: InternalLedgerBookGuard;
}

export type LedgerModule = ReturnType<typeof createLedgerModule>;

export function createLedgerModule(deps: LedgerModuleDeps) {
  const createRuntime = (service: string) =>
    createModuleRuntime({
      generateUuid: deps.generateUuid,
      logger: deps.logger,
      now: deps.now,
      service,
    });
  const settlementIdentity = new TigerBeetleSettlementIdentityPolicy();

  return {
    operations: createOperationsService({
      runtime: createRuntime("ledger.operations"),
      reads: deps.operationsReads,
      commandUow: deps.unitOfWork,
      settlementIdentity,
      ...(deps.assertInternalLedgerBooks
        ? {
            assertInternalLedgerBooks: deps.assertInternalLedgerBooks,
          }
        : {}),
    }),
    books: createBooksService({
      runtime: createRuntime("ledger.books"),
      reads: deps.booksReads,
      commandUow: deps.unitOfWork,
    }),
    bookAccounts: createBookAccountsService({
      runtime: createRuntime("ledger.book-accounts"),
      commandUow: deps.unitOfWork,
    }),
    balances: createBalancesService({
      reads: deps.balancesReads,
      commandUow: deps.unitOfWork,
    }),
    reports: createReportsService({
      reads: deps.reportsReads,
    }),
  };
}
