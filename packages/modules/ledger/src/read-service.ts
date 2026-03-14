import type { Database, Transaction } from "@bedrock/platform/persistence";

import {
  createLedgerReadQueries,
  type LedgerReadService,
} from "./application/operations/read-queries";
import { createDrizzleLedgerReadRepository } from "./infra/drizzle/repos/ledger-read-repository";

type Queryable = Database | Transaction;

export function createLedgerReadService(input: {
  db: Queryable;
}): LedgerReadService {
  return createLedgerReadQueries({
    reads: createDrizzleLedgerReadRepository(input.db),
  });
}

export type { LedgerReadService };
