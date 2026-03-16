import type { Transaction } from "@bedrock/platform/persistence";

import { createDocumentsHandlers } from "./application";
import type { DocumentsServiceDeps } from "./application/service-deps";
import type { DocumentsIdempotencyPort } from "./application/shared/external-ports";
import {
  createDrizzleDocumentEventsRepository,
  createDrizzleDocumentLinksRepository,
  createDrizzleDocumentOperationsRepository,
  createDrizzleDocumentSnapshotsRepository,
  createDrizzleDocumentsCommandRepository,
  createDrizzleDocumentsQueryRepository,
} from "./infra/drizzle/repository";
import { createDrizzleDocumentsReadModel } from "./read-model";

export function createDocumentsService(deps: DocumentsServiceDeps) {
  return createDocumentsHandlers(deps);
}

export type DocumentsService = ReturnType<typeof createDocumentsService>;
export interface DocumentsServiceTransactionDeps extends Omit<
  DocumentsServiceDeps,
  | "transactions"
  | "documentEvents"
  | "documentLinks"
  | "documentOperations"
  | "documentSnapshots"
  | "documentsQuery"
  | "moduleRuntime"
> {
  tx: Transaction;
  idempotency: DocumentsIdempotencyPort;
}

export function createDocumentsServiceFromTransaction(
  deps: DocumentsServiceTransactionDeps,
) {
  return createDocumentsHandlers({
    accounting: deps.accounting,
    accountingPeriods: deps.accountingPeriods,
    documentEvents: createDrizzleDocumentEventsRepository(deps.tx),
    documentLinks: createDrizzleDocumentLinksRepository(deps.tx),
    documentOperations: createDrizzleDocumentOperationsRepository(deps.tx),
    documentSnapshots: createDrizzleDocumentSnapshotsRepository(deps.tx),
    documentsQuery: createDrizzleDocumentsQueryRepository(deps.tx),
    ledgerReadService: deps.ledgerReadService,
    moduleRuntime: {
      documents: createDrizzleDocumentsReadModel({ db: deps.tx }),
      withQueryable: (run) => run(deps.tx),
    },
    policy: deps.policy,
    registry: deps.registry,
    transactions: {
      withTransaction: (run) =>
        run({
          moduleRuntime: {
            documents: createDrizzleDocumentsReadModel({ db: deps.tx }),
            withQueryable: (query) => query(deps.tx),
          },
          idempotency: deps.idempotency,
          documentsCommand: createDrizzleDocumentsCommandRepository(deps.tx),
          documentEvents: createDrizzleDocumentEventsRepository(deps.tx),
          documentLinks: createDrizzleDocumentLinksRepository(deps.tx),
          documentOperations: createDrizzleDocumentOperationsRepository(deps.tx),
        }),
    },
    logger: deps.logger,
    now: deps.now,
  });
}

export type { DocumentsServiceContext } from "./application";
