import { noopLogger, type Logger } from "@bedrock/common";
import {
  createIdempotencyService,
  type IdempotencyService,
} from "@bedrock/platform/operations";

import { createDefaultDocumentActionPolicyService } from "../policy";
import type { DocumentsServiceDeps } from "../types";

export interface DocumentsServiceContext {
  accounting: DocumentsServiceDeps["accounting"];
  db: DocumentsServiceDeps["db"];
  idempotency: IdempotencyService;
  ledger: DocumentsServiceDeps["ledger"];
  ledgerReadService: DocumentsServiceDeps["ledgerReadService"];
  policy: NonNullable<DocumentsServiceDeps["policy"]>;
  registry: DocumentsServiceDeps["registry"];
  log: Logger;
}

export function createDocumentsServiceContext(
  deps: DocumentsServiceDeps,
): DocumentsServiceContext {
  return {
    accounting: deps.accounting,
    db: deps.db,
    idempotency: createIdempotencyService({ logger: deps.logger }),
    ledger: deps.ledger,
    ledgerReadService: deps.ledgerReadService,
    policy: deps.policy ?? createDefaultDocumentActionPolicyService(),
    registry: deps.registry,
    log: deps.logger?.child({ svc: "documents" }) ?? noopLogger,
  };
}
