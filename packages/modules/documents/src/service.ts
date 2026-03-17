import type { IdempotencyPort } from "@bedrock/platform/idempotency";
import type { PersistenceContext } from "@bedrock/platform/persistence";

import { createDocumentsHandlers } from "./application";
import type { DocumentsServiceDeps as DocumentsHandlersDeps } from "./application/service-deps";
import {
  createDocumentsModuleRuntime,
  createDocumentsTransactions,
} from "./application/shared/transaction-context";
import {
  createDrizzleDocumentEventsRepository,
  createDrizzleDocumentLinksRepository,
  createDrizzleDocumentOperationsRepository,
  createDrizzleDocumentSnapshotsRepository,
  createDrizzleDocumentsQueryRepository,
} from "./infra/drizzle/repository";
export interface DocumentsServiceDeps
  extends Omit<
    DocumentsHandlersDeps,
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
