import {
  noopLogger,
  type Logger,
} from "@bedrock/platform/observability/logger";
import type { Database } from "@bedrock/platform/persistence";

import type {
  ReconciliationDocumentsPort,
  ReconciliationIdempotencyPort,
  ReconciliationLedgerLookupPort,
} from "./external-ports";
import { createDrizzlePendingSourcesQuerySupport } from "../../infra/drizzle/query-support/pending-sources";
import { createDrizzleReconciliationExceptionsRepository } from "../../infra/drizzle/repos/exceptions-repo";
import { createDrizzleReconciliationExternalRecordsRepository } from "../../infra/drizzle/repos/external-records-repo";
import { createDrizzleReconciliationMatchesRepository } from "../../infra/drizzle/repos/matches-repo";
import { createDrizzleReconciliationRunsRepository } from "../../infra/drizzle/repos/runs-repo";

export interface ReconciliationServiceDeps {
  db: Database;
  documents: ReconciliationDocumentsPort;
  idempotency: ReconciliationIdempotencyPort;
  ledgerLookup: ReconciliationLedgerLookupPort;
  logger?: Logger;
}

export interface ReconciliationServiceContext {
  db: Database;
  documents: ReconciliationDocumentsPort;
  idempotency: ReconciliationIdempotencyPort;
  ledgerLookup: ReconciliationLedgerLookupPort;
  externalRecordsRepo: ReturnType<
    typeof createDrizzleReconciliationExternalRecordsRepository
  >;
  runsRepo: ReturnType<typeof createDrizzleReconciliationRunsRepository>;
  matchesRepo: ReturnType<typeof createDrizzleReconciliationMatchesRepository>;
  exceptionsRepo: ReturnType<
    typeof createDrizzleReconciliationExceptionsRepository
  >;
  pendingSources: ReturnType<typeof createDrizzlePendingSourcesQuerySupport>;
  log: Logger;
}

export function createReconciliationServiceContext(
  deps: ReconciliationServiceDeps,
): ReconciliationServiceContext {
  return {
    db: deps.db,
    documents: deps.documents,
    idempotency: deps.idempotency,
    ledgerLookup: deps.ledgerLookup,
    externalRecordsRepo: createDrizzleReconciliationExternalRecordsRepository(),
    runsRepo: createDrizzleReconciliationRunsRepository(),
    matchesRepo: createDrizzleReconciliationMatchesRepository(deps.db),
    exceptionsRepo: createDrizzleReconciliationExceptionsRepository(deps.db),
    pendingSources: createDrizzlePendingSourcesQuerySupport({ db: deps.db }),
    log: deps.logger?.child({ svc: "reconciliation" }) ?? noopLogger,
  };
}
