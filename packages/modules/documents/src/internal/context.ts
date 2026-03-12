import { noopLogger, type Logger } from "@bedrock/common";

import { createDefaultDocumentActionPolicyService } from "../policy";
import type { DocumentsServiceDeps } from "../types";

export interface DocumentsServiceContext {
  accounting: DocumentsServiceDeps["accounting"];
  db: DocumentsServiceDeps["db"];
  idempotency: DocumentsServiceDeps["idempotency"];
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
    idempotency: deps.idempotency,
    ledger: deps.ledger,
    ledgerReadService: deps.ledgerReadService,
    policy: deps.policy ?? createDefaultDocumentActionPolicyService(),
    registry: deps.registry,
    log: deps.logger?.child({ svc: "documents" }) ?? noopLogger,
  };
}
