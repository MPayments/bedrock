import type { IdempotencyPort } from "@bedrock/platform/idempotency";
import type { PersistenceContext } from "@bedrock/platform/persistence";

import { createDocumentsHandlers } from "./application";
import type { DocumentsServiceDeps as DocumentsHandlersDeps } from "./application/service-deps";
import {
  createDrizzleDocumentBusinessLinksRepository,
  createDrizzleDocumentEventsRepository,
  createDrizzleDocumentLinksRepository,
  createDrizzleDocumentOperationsRepository,
  createDrizzleDocumentSnapshotsRepository,
  createDrizzleDocumentsQueryRepository,
} from "./infra/drizzle/repository";
import {
  createDocumentsModuleRuntime,
  createDocumentsTransactions,
} from "./infra/transaction-context";
export interface DocumentsServiceDeps
  extends Omit<
    DocumentsHandlersDeps,
    | "documentBusinessLinks"
    | "documentEvents"
    | "documentLinks"
    | "documentOperations"
    | "documentSnapshots"
    | "documentsQuery"
    | "moduleRuntime"
    | "transactions"
  > {
  persistence: PersistenceContext;
  idempotency: IdempotencyPort;
}

function createDocumentsHandlerDeps(
  deps: DocumentsServiceDeps,
): DocumentsHandlersDeps {
  return {
    accounting: deps.accounting,
    accountingPeriods: deps.accountingPeriods,
    documentBusinessLinks: createDrizzleDocumentBusinessLinksRepository(
      deps.persistence.db,
    ),
    documentEvents: createDrizzleDocumentEventsRepository(deps.persistence.db),
    documentLinks: createDrizzleDocumentLinksRepository(deps.persistence.db),
    documentOperations: createDrizzleDocumentOperationsRepository(
      deps.persistence.db,
    ),
    documentSnapshots: createDrizzleDocumentSnapshotsRepository(
      deps.persistence.db,
    ),
    documentsQuery: createDrizzleDocumentsQueryRepository(deps.persistence.db),
    ledgerReadService: deps.ledgerReadService,
    moduleRuntime: createDocumentsModuleRuntime(deps.persistence.db),
    policy: deps.policy,
    registry: deps.registry,
    transitionEffects: deps.transitionEffects,
    transactions: createDocumentsTransactions({
      persistence: deps.persistence,
      idempotency: deps.idempotency,
    }),
    logger: deps.logger,
    now: deps.now,
  };
}

export function createDocumentsService(deps: DocumentsServiceDeps) {
  return createDocumentsHandlers(createDocumentsHandlerDeps(deps));
}

export type DocumentsService = ReturnType<typeof createDocumentsService>;

export type { DocumentsServiceContext } from "./application";
