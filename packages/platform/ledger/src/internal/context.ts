import type { Database } from "@bedrock/db";

export interface LedgerDeps {
  db: Database;
}

export interface LedgerContext {
  db: Database;
}

export function createLedgerContext(deps: LedgerDeps): LedgerContext {
  return { db: deps.db };
}
