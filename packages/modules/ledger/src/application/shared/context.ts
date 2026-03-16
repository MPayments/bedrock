import type { LedgerBookAccountsPort } from "../book-accounts/ports";
import type { LedgerOperationsWritePort } from "../commit/ports";
import type { LedgerReadPort } from "../operations/ports";
import type { LedgerReportingPort } from "../reporting/ports";

export type InternalLedgerBookGuard = (input: {
  bookIds: string[];
}) => Promise<void>;

export interface LedgerContext {
  assertInternalLedgerBooks?: InternalLedgerBookGuard;
  bookAccounts: LedgerBookAccountsPort;
  operations: LedgerOperationsWritePort;
  reads: LedgerReadPort;
  reporting: LedgerReportingPort;
}

export function createLedgerContext(input: LedgerContext): LedgerContext {
  return input;
}
