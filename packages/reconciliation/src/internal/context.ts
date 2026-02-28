import type { Database } from "@bedrock/db";
import type { DocumentsService } from "@bedrock/documents";
import {
  createIdempotencyService,
  type IdempotencyService,
} from "@bedrock/idempotency";
import { noopLogger, type Logger } from "@bedrock/kernel";

export interface ReconciliationServiceDeps {
  db: Database;
  documents: Pick<DocumentsService, "createDraft">;
  logger?: Logger;
}

export interface ReconciliationServiceContext {
  db: Database;
  documents: Pick<DocumentsService, "createDraft">;
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
