import { noopLogger, type Logger } from "@bedrock/platform/observability/logger";

import { createDefaultDocumentActionPolicyService } from "../policy/default-action-policy";
import type { DocumentsServiceDeps } from "../service-deps";
import { createNoopDocumentTransitionEffectsService } from "./transition-effects";

export interface DocumentsServiceContext {
  accounting: DocumentsServiceDeps["accounting"];
  accountingPeriods: DocumentsServiceDeps["accountingPeriods"];
  documentBusinessLinks: DocumentsServiceDeps["documentBusinessLinks"];
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
  transitionEffects: NonNullable<DocumentsServiceDeps["transitionEffects"]>;
  transactions: DocumentsServiceDeps["transactions"];
  log: Logger;
}

export function createDocumentsServiceContext(
  deps: DocumentsServiceDeps,
): DocumentsServiceContext {
  return {
    accounting: deps.accounting,
    accountingPeriods: deps.accountingPeriods,
    documentBusinessLinks: deps.documentBusinessLinks,
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
    transitionEffects:
      deps.transitionEffects ?? createNoopDocumentTransitionEffectsService(),
    transactions: deps.transactions,
    log: deps.logger?.child({ svc: "documents" }) ?? noopLogger,
  };
}
