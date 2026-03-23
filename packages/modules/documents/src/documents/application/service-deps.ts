import type { ModuleRuntime } from "@bedrock/shared/core";

import type {
  DocumentEventsRepository,
  DocumentLinksRepository,
  DocumentOperationsRepository,
  DocumentSnapshotsRepository,
  DocumentsCommandUnitOfWork,
  DocumentsQueryRepository,
} from "./ports";
import type {
  DocumentActionPolicyService,
  DocumentModuleRuntime,
  DocumentRegistry,
} from "../../plugins";
import type { DocumentsAccountingPeriodsPort, DocumentsLedgerReadPort } from "../../posting/application/ports";

export interface DocumentsServiceDeps {
  runtime: ModuleRuntime;
  commandUow: DocumentsCommandUnitOfWork;
  accountingPeriods: DocumentsAccountingPeriodsPort;
  documentsQuery: DocumentsQueryRepository;
  documentEvents: Pick<DocumentEventsRepository, "listDocumentEvents">;
  documentLinks: Pick<DocumentLinksRepository, "listDocumentLinks">;
  documentOperations: Pick<
    DocumentOperationsRepository,
    "findPostingOperationId" | "listDocumentOperations"
  >;
  documentSnapshots: Pick<DocumentSnapshotsRepository, "findDocumentSnapshot">;
  ledgerReadService: DocumentsLedgerReadPort;
  moduleRuntime: DocumentModuleRuntime;
  registry: DocumentRegistry;
  policy: DocumentActionPolicyService;
}
