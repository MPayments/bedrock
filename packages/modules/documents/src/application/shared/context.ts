import { noopLogger, type Logger } from "@bedrock/platform/observability/logger";

import { createDefaultDocumentActionPolicyService } from "../../domain/default-action-policy";
import type { DocumentsServiceDeps } from "../../types";

export interface DocumentsServiceContext {
  accounting: DocumentsServiceDeps["accounting"];
  accountingPeriods: DocumentsServiceDeps["accountingPeriods"];
  ledgerReadService: DocumentsServiceDeps["ledgerReadService"];
  moduleDb: DocumentsServiceDeps["moduleDb"];
  policy: NonNullable<DocumentsServiceDeps["policy"]>;
  repository: DocumentsServiceDeps["repository"];
  registry: DocumentsServiceDeps["registry"];
  transactions: DocumentsServiceDeps["transactions"];
  log: Logger;
}

export function createDocumentsServiceContext(
  deps: DocumentsServiceDeps,
): DocumentsServiceContext {
  return {
    accounting: deps.accounting,
    accountingPeriods: deps.accountingPeriods,
    ledgerReadService: deps.ledgerReadService,
    moduleDb: deps.moduleDb,
    policy: deps.policy ?? createDefaultDocumentActionPolicyService(),
    repository: deps.repository,
    registry: deps.registry,
    transactions: deps.transactions,
    log: deps.logger?.child({ svc: "documents" }) ?? noopLogger,
  };
}
