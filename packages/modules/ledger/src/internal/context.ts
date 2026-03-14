import type { Database } from "@bedrock/platform-persistence";

export interface InternalLedgerBookGuard {
  (input: { db: Database; bookIds: string[] }): Promise<void>;
}

export interface LedgerDeps {
  db: Database;
  assertInternalLedgerBooks?: InternalLedgerBookGuard;
}

export interface LedgerContext {
  db: Database;
  assertInternalLedgerBooks?: InternalLedgerBookGuard;
}

export function createLedgerContext(deps: LedgerDeps): LedgerContext {
  return {
    db: deps.db,
    assertInternalLedgerBooks: deps.assertInternalLedgerBooks,
  };
}
