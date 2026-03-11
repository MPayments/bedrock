import type { Transaction } from "@multihansa/common/sql/ports";

import { createCommitHandler } from "./commands/commit";
import { createLedgerContext, type LedgerDeps } from "./internal/context";
import { type CommitResult, type OperationIntent } from "./types";

export interface LedgerEngine {
  commit: (tx: Transaction, intent: OperationIntent) => Promise<CommitResult>;
  commitStandalone: (intent: OperationIntent) => Promise<CommitResult>;
}

export function createLedgerEngine(deps: LedgerDeps): LedgerEngine {
  const context = createLedgerContext(deps);
  const commit = createCommitHandler(context);
  const { db } = context;

  async function commitStandalone(
    intent: OperationIntent,
  ): Promise<CommitResult> {
    return db.transaction(async (tx: Transaction) => commit(tx, intent));
  }

  return {
    commit,
    commitStandalone,
  };
}
