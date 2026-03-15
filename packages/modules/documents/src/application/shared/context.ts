import { noopLogger, type Logger } from "@bedrock/platform/observability/logger";

import { createDefaultDocumentActionPolicyService } from "../policy/default-action-policy";
import type { DocumentsServiceDeps } from "../service-deps";

export interface DocumentsServiceContext {
  accounting: DocumentsServiceDeps["accounting"];
  accountingPeriods: DocumentsServiceDeps["accountingPeriods"];
  documentEvents: DocumentsServiceDeps["documentEvents"];
  documentLinks: DocumentsServiceDeps["documentLinks"];
  documentOperations: DocumentsServiceDeps["documentOperations"];
  documentSnapshots: DocumentsServiceDeps["documentSnapshots"];
  documentsQuery: DocumentsServiceDeps["documentsQuery"];
  ledgerReadService: DocumentsServiceDeps["ledgerReadService"];
  moduleRuntime: DocumentsServiceDeps["moduleRuntime"];
  now: () => Date;
  policy: NonNullable<DocumentsServiceDeps["policy"]>;
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
    documentEvents: deps.documentEvents,
    documentLinks: deps.documentLinks,
    documentOperations: deps.documentOperations,
    documentSnapshots: deps.documentSnapshots,
    documentsQuery: deps.documentsQuery,
    ledgerReadService: deps.ledgerReadService,
    moduleRuntime: deps.moduleRuntime,
    now: deps.now ?? (() => new Date()),
    policy: deps.policy ?? createDefaultDocumentActionPolicyService(),
    registry: deps.registry,
    transactions: deps.transactions,
    log: deps.logger?.child({ svc: "documents" }) ?? noopLogger,
  };
}
