import { noopLogger, type Logger } from "@bedrock/common";
import type { CorrelationContext } from "@bedrock/common";
import type { Database } from "@bedrock/common/sql/ports";
import {
  createIdempotencyService,
  type IdempotencyService,
} from "@bedrock/platform/operations";

export interface ReconciliationDocumentsPort {
  createDraft?: (input: {
    docType: string;
    createIdempotencyKey: string;
    payload: Record<string, unknown>;
    actorUserId: string;
    requestContext?: CorrelationContext;
  }) => Promise<{ document: { id: string } }>;
  hasDocument?: (documentId: string) => Promise<boolean>;
}

export interface ReconciliationServiceDeps {
  db: Database;
  documents?: ReconciliationDocumentsPort;
  logger?: Logger;
}

export interface ReconciliationServiceContext {
  db: Database;
  documents?: ReconciliationDocumentsPort;
  idempotency: IdempotencyService;
  log: Logger;
}

export function createReconciliationServiceContext(
  deps: ReconciliationServiceDeps,
): ReconciliationServiceContext {
  return {
    db: deps.db,
    documents: deps.documents,
    idempotency: createIdempotencyService({ logger: deps.logger }),
    log: deps.logger?.child({ svc: "reconciliation" }) ?? noopLogger,
  };
}
