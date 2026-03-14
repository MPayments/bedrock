import type { LedgerReadPort } from "./ports";

export type LedgerReadService = LedgerReadPort;

export function createLedgerReadQueries(input: {
  reads: LedgerReadPort;
}): LedgerReadPort {
  return input.reads;
}
