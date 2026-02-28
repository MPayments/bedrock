import { noopLogger, type Logger } from "@bedrock/kernel";

import type { DocumentsServiceDeps } from "../types";

export interface DocumentsServiceContext {
  db: DocumentsServiceDeps["db"];
  ledger: DocumentsServiceDeps["ledger"];
  ledgerReadService: DocumentsServiceDeps["ledgerReadService"];
  registry: DocumentsServiceDeps["registry"];
  log: Logger;
}

export function createDocumentsServiceContext(
  deps: DocumentsServiceDeps,
): DocumentsServiceContext {
  return {
    db: deps.db,
    ledger: deps.ledger,
    ledgerReadService: deps.ledgerReadService,
    registry: deps.registry,
    log: deps.logger?.child({ svc: "documents" }) ?? noopLogger,
  };
}
