import type { Database, Transaction } from "@bedrock/platform/persistence";

import type { EnsureDefaultOrganizationBookInput } from "./application/books/ports";
import type { BookAccountIdentityInput } from "./domain/book-account-identity";
import type { CommitResult, OperationIntent } from "./contracts";
import {
  createEnsureBookAccountInstanceHandler,
} from "./application/book-accounts/ensure-book-account-instance";
import {
  createEnsureDefaultOrganizationBookHandler,
} from "./application/books/ensure-default-organization-book";
import {
  createCommitOperationHandler,
} from "./application/commit/commit-operation";
import {
  createLedgerReadQueries,
  type LedgerReadService,
} from "./application/operations/read-queries";
import {
  createLedgerContext,
  type LedgerServiceDeps,
} from "./application/shared/context";
import { createDrizzleLedgerBookAccountsRepository } from "./infra/drizzle/repos/book-account-instances-repository";
import { createDrizzleLedgerBooksRepository } from "./infra/drizzle/repos/books-repository";
import { createDrizzleLedgerOperationsRepository } from "./infra/drizzle/repos/ledger-operations-repository";
import { createDrizzleLedgerReadRepository } from "./infra/drizzle/repos/ledger-read-repository";
import { createDrizzleLedgerReportingRepository } from "./infra/drizzle/repos/ledger-reporting-repository";

export interface LedgerCommitService {
  commit: (tx: Transaction, intent: OperationIntent) => Promise<CommitResult>;
  commitStandalone: (intent: OperationIntent) => Promise<CommitResult>;
}

export interface LedgerBookAccountsService {
  ensureBookAccountInstance: (
    tx: Transaction,
    input: BookAccountIdentityInput,
  ) => Promise<{
    id: string;
    dimensionsHash: string;
    tbLedger: number;
    tbAccountId: bigint;
  }>;
}

export interface LedgerBooksService {
  ensureDefaultOrganizationBook: (
    tx: Transaction,
    input: EnsureDefaultOrganizationBookInput,
  ) => Promise<{ bookId: string }>;
}

export interface LedgerService {
  commit: LedgerCommitService;
  read: LedgerReadService;
  bookAccounts: LedgerBookAccountsService;
  books: LedgerBooksService;
}

export function createLedgerCommitService(
  deps: LedgerServiceDeps,
): LedgerCommitService {
  const context = createLedgerContext({
    db: deps.db,
    assertInternalLedgerBooks: deps.assertInternalLedgerBooks,
    bookAccounts: createDrizzleLedgerBookAccountsRepository(),
    operations: createDrizzleLedgerOperationsRepository(),
    reads: createDrizzleLedgerReadRepository(deps.db),
    reporting: createDrizzleLedgerReportingRepository(deps.db),
  });
  const commit = createCommitOperationHandler(context);

  async function commitStandalone(
    intent: OperationIntent,
  ): Promise<CommitResult> {
    return context.db.transaction((tx: Transaction) => commit(tx, intent));
  }

  return {
    commit,
    commitStandalone,
  };
}

export function createLedgerReadService(input: {
  db: Database;
}): LedgerReadService {
  return createLedgerReadQueries({
    reads: createDrizzleLedgerReadRepository(input.db),
  });
}

export function createLedgerBookAccountsService(): LedgerBookAccountsService {
  const ensureBookAccountInstanceTx = createEnsureBookAccountInstanceHandler({
    bookAccounts: createDrizzleLedgerBookAccountsRepository(),
  });

  return {
    ensureBookAccountInstance(
      tx: Transaction,
      identity: BookAccountIdentityInput,
    ) {
      return ensureBookAccountInstanceTx(tx, identity);
    },
  };
}

export function createLedgerBooksService(): LedgerBooksService {
  const ensureDefaultOrganizationBook = createEnsureDefaultOrganizationBookHandler(
    {
      books: createDrizzleLedgerBooksRepository(),
    },
  );

  return {
    ensureDefaultOrganizationBook,
  };
}

export function createLedgerService(deps: LedgerServiceDeps): LedgerService {
  return {
    commit: createLedgerCommitService(deps),
    read: createLedgerReadService({ db: deps.db }),
    bookAccounts: createLedgerBookAccountsService(),
    books: createLedgerBooksService(),
  };
}

export type { LedgerReadService, LedgerServiceDeps };
