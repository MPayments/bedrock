import type { Database } from "@bedrock/platform/persistence";

import type { LedgerBookAccountsPort } from "../book-accounts/ports";
import type { LedgerOperationsWritePort } from "../commit/ports";
import type { LedgerReadPort } from "../operations/ports";
import type { LedgerReportingPort } from "../reporting/ports";

export interface InternalLedgerBookGuard {
  (input: { db: Database; bookIds: string[] }): Promise<void>;
}

export interface LedgerServiceDeps {
  db: Database;
  assertInternalLedgerBooks?: InternalLedgerBookGuard;
}

export interface LedgerContext {
  db: Database;
  assertInternalLedgerBooks?: InternalLedgerBookGuard;
  bookAccounts: LedgerBookAccountsPort;
  operations: LedgerOperationsWritePort;
  reads: LedgerReadPort;
  reporting: LedgerReportingPort;
}

export function createLedgerContext(input: LedgerContext): LedgerContext {
  return input;
}
