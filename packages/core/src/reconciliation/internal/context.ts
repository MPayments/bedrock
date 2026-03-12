import type { Database } from "@bedrock/kernel/db/types";
import { noopLogger, type Logger } from "@bedrock/kernel";
import type { DocumentsService } from "@bedrock/core/documents";
import {
  createIdempotencyService,
  type IdempotencyService,
} from "@bedrock/core/idempotency";

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
