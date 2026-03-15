import type { Queryable } from "@bedrock/platform/persistence";

import {
  createLedgerReportingQueries,
  type LedgerQueries,
} from "./application/reporting/queries";
import { createDrizzleLedgerReadRepository } from "./infra/drizzle/repos/ledger-read-repository";
import { createDrizzleLedgerReportingRepository } from "./infra/drizzle/repos/ledger-reporting-repository";

export function createLedgerQueries(input: { db: Queryable }): LedgerQueries {
  return createLedgerReportingQueries({
    reads: createDrizzleLedgerReadRepository(input.db),
    reporting: createDrizzleLedgerReportingRepository(input.db),
  });
}

export type { LedgerQueries };
export type {
  AccountingScopedPostingRow,
  LedgerBookRow,
  LedgerOperationDetails,
} from "./contracts";
