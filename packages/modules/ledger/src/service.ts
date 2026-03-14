import type { Transaction } from "@bedrock/platform/persistence";

import {
  createCommitOperationHandler,
} from "./application/commit/commit-operation";
import {
  createLedgerContext,
  type LedgerServiceDeps,
} from "./application/shared/context";
import type { CommitResult, OperationIntent } from "./contracts";
import { createDrizzleLedgerBookAccountsRepository } from "./infra/drizzle/repos/book-account-instances-repository";
import { createDrizzleLedgerOperationsRepository } from "./infra/drizzle/repos/ledger-operations-repository";
import { createDrizzleLedgerReadRepository } from "./infra/drizzle/repos/ledger-read-repository";
import { createDrizzleLedgerReportingRepository } from "./infra/drizzle/repos/ledger-reporting-repository";

export interface LedgerService {
  commit: (tx: Transaction, intent: OperationIntent) => Promise<CommitResult>;
  commitStandalone: (intent: OperationIntent) => Promise<CommitResult>;
}

export function createLedgerService(deps: LedgerServiceDeps): LedgerService {
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
