import type { Database } from "@bedrock/db/types";
import { noopLogger, type Logger } from "@bedrock/foundation/kernel";
import type { DocumentsService } from "@bedrock/platform/documents";
import {
  createIdempotencyService,
  type IdempotencyService,
} from "@bedrock/platform/idempotency";

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
