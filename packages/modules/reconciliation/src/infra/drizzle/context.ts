import type { Database } from "@bedrock/platform/persistence";

import { createDrizzlePendingSourcesQuerySupport } from "./query-support/pending-sources";
import { createDrizzleReconciliationExceptionsRepository } from "./repos/exceptions-repo";
import { createDrizzleReconciliationExternalRecordsRepository } from "./repos/external-records-repo";
import { createDrizzleReconciliationMatchesRepository } from "./repos/matches-repo";
import { createDrizzleReconciliationRunsRepository } from "./repos/runs-repo";
import type { ReconciliationPendingSourcesPort } from "../../application/exceptions/ports";

export function createDrizzleReconciliationServiceAdapters(db: Database): {
  externalRecordsRepo: ReturnType<
    typeof createDrizzleReconciliationExternalRecordsRepository
  >;
  runsRepo: ReturnType<typeof createDrizzleReconciliationRunsRepository>;
  matchesRepo: ReturnType<typeof createDrizzleReconciliationMatchesRepository>;
  exceptionsRepo: ReturnType<typeof createDrizzleReconciliationExceptionsRepository>;
  pendingSources: ReconciliationPendingSourcesPort;
} {
  return {
    externalRecordsRepo: createDrizzleReconciliationExternalRecordsRepository(),
    runsRepo: createDrizzleReconciliationRunsRepository(),
    matchesRepo: createDrizzleReconciliationMatchesRepository(db),
    exceptionsRepo: createDrizzleReconciliationExceptionsRepository(db),
    pendingSources: createDrizzlePendingSourcesQuerySupport({ db }),
  };
}
