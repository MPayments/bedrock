import type { Database, Transaction } from "@bedrock/platform/persistence";
import type { PersistenceSession } from "@bedrock/shared/core/persistence";

import { createEnsureBookAccountInstanceHandler } from "./application/book-accounts/ensure-book-account-instance";
import { createEnsureDefaultOrganizationBookHandler } from "./application/books/ensure-default-organization-book";
import type { EnsureDefaultOrganizationBookInput } from "./application/books/ports";
import { createCommitOperationHandler } from "./application/commit/commit-operation";
import {
  createLedgerReadQueries,
  type LedgerReadService,
} from "./application/operations/read-queries";
import {
  createLedgerContext,
  type InternalLedgerBookGuard,
} from "./application/shared/context";
import type { CommitResult, OperationIntentInput } from "./contracts";
import type { BookAccountIdentityInput } from "./domain/book-account-identity";
import { createDrizzleLedgerBookAccountsRepository } from "./infra/drizzle/repos/book-account-instances-repository";
import { createDrizzleLedgerBooksRepository } from "./infra/drizzle/repos/books-repository";
import { createDrizzleLedgerOperationsRepository } from "./infra/drizzle/repos/ledger-operations-repository";
import { createDrizzleLedgerReadRepository } from "./infra/drizzle/repos/ledger-read-repository";
import { createDrizzleLedgerReportingRepository } from "./infra/drizzle/repos/ledger-reporting-repository";

export interface LedgerCommitService {
  commit: (
    tx: Transaction,
    intent: OperationIntentInput,
  ) => Promise<CommitResult>;
  commitStandalone: (intent: OperationIntentInput) => Promise<CommitResult>;
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

export interface LedgerServiceDeps {
  db: Database;
  assertInternalLedgerBooks?: InternalLedgerBookGuard;
}

export function createLedgerCommitService(
  deps: LedgerServiceDeps,
): LedgerCommitService {
  const context = createLedgerContext({
    ...(deps.assertInternalLedgerBooks
      ? { assertInternalLedgerBooks: deps.assertInternalLedgerBooks }
      : {}),
    bookAccounts: createDrizzleLedgerBookAccountsRepository(),
    operations: createDrizzleLedgerOperationsRepository(),
    reads: createDrizzleLedgerReadRepository(deps.db),
    reporting: createDrizzleLedgerReportingRepository(deps.db),
  });
  const commitInSession = createCommitOperationHandler(context);

  async function commitStandalone(
    intent: OperationIntentInput,
  ): Promise<CommitResult> {
    return deps.db.transaction((tx: Transaction) =>
      commitInSession(tx as PersistenceSession, intent),
    );
  }

  return {
    commit(tx, intent) {
      return commitInSession(tx as PersistenceSession, intent);
    },
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
  const ensureBookAccountInstanceInSession =
    createEnsureBookAccountInstanceHandler({
      bookAccounts: createDrizzleLedgerBookAccountsRepository(),
    });

  return {
    ensureBookAccountInstance(
      tx: Transaction,
      identity: BookAccountIdentityInput,
    ) {
      return ensureBookAccountInstanceInSession(
        tx as PersistenceSession,
        identity,
      );
    },
  };
}

export function createLedgerBooksService(): LedgerBooksService {
  const ensureDefaultOrganizationBookInSession =
    createEnsureDefaultOrganizationBookHandler({
      books: createDrizzleLedgerBooksRepository(),
    });

  return {
    ensureDefaultOrganizationBook(tx, input) {
      return ensureDefaultOrganizationBookInSession(
        tx as PersistenceSession,
        input,
      );
    },
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

export type { LedgerReadService };
