import { noopLogger, type Logger } from "@bedrock/platform/observability/logger";

import { createDefaultDocumentActionPolicyService } from "../policy/default-action-policy";
import type { DocumentsServiceDeps } from "../service-deps";

export interface DocumentsServiceContext {
  accounting: DocumentsServiceDeps["accounting"];
  accountingPeriods: DocumentsServiceDeps["accountingPeriods"];
  ledgerReadService: DocumentsServiceDeps["ledgerReadService"];
  moduleRuntime: DocumentsServiceDeps["moduleRuntime"];
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
    moduleRuntime: deps.moduleRuntime,
    policy: deps.policy ?? createDefaultDocumentActionPolicyService(),
    repository: deps.repository,
    registry: deps.registry,
    transactions: deps.transactions,
    log: deps.logger?.child({ svc: "documents" }) ?? noopLogger,
  };
}
