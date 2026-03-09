import type { DocumentsService } from "@bedrock/documents/runtime";
import { noopLogger, type Logger } from "@bedrock/kernel";
import {
  createIdempotencyService,
  type IdempotencyService,
} from "@bedrock/operations";
import type { Database } from "@bedrock/sql/ports";

export interface ReconciliationServiceDeps {
  db: Database;
  documents?: Pick<DocumentsService, "createDraft">;
  logger?: Logger;
}

export interface ReconciliationServiceContext {
  db: Database;
  documents?: Pick<DocumentsService, "createDraft">;
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
