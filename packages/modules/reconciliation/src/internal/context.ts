import { noopLogger, type Logger } from "@bedrock/kernel/logger";
import type { Database } from "@bedrock/kernel/db/types";

import type {
  ReconciliationDocumentsPort,
  ReconciliationIdempotencyPort,
  ReconciliationLedgerLookupPort,
} from "../ports";

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
    log: deps.logger?.child({ svc: "reconciliation" }) ?? noopLogger,
  };
}
