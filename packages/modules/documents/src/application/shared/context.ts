import { noopLogger, type Logger } from "@bedrock/platform/observability/logger";

import { createDefaultDocumentActionPolicyService } from "../../domain/default-action-policy";
import type { DocumentsServiceDeps } from "../../types";

export interface DocumentsServiceContext {
  accounting: DocumentsServiceDeps["accounting"];
  accountingPeriods: DocumentsServiceDeps["accountingPeriods"];
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
    accountingPeriods: deps.accountingPeriods,
    db: deps.db,
    idempotency: deps.idempotency,
    ledger: deps.ledger,
    ledgerReadService: deps.ledgerReadService,
    policy: deps.policy ?? createDefaultDocumentActionPolicyService(),
    registry: deps.registry,
    log: deps.logger?.child({ svc: "documents" }) ?? noopLogger,
  };
}
