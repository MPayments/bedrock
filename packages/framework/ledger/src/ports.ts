import type { CommitResult, OperationIntent } from "./types";

export interface LedgerAdapter {
  submit(intent: OperationIntent): Promise<CommitResult>;
}

export interface RawLedgerAdapter {
  createAccounts?(input: unknown[]): Promise<unknown>;
  createTransfers?(input: unknown[]): Promise<unknown>;
  lookupAccounts?(input: unknown[]): Promise<unknown>;
}
