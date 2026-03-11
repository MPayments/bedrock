import type { Database } from "@multihansa/common/sql/ports";

export interface LedgerDeps {
  db: Database;
}

export interface LedgerContext {
  db: Database;
}

export function createLedgerContext(deps: LedgerDeps): LedgerContext {
  return { db: deps.db };
}
