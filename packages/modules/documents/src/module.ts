import type { Logger } from "@bedrock/platform/observability/logger";
import {
  createModuleRuntime,
  type Clock,
  type UuidGenerator,
} from "@bedrock/shared/core";

import { createDocumentsService } from "./documents/application";
import type {
  DocumentEventsRepository,
  DocumentLinksRepository,
  DocumentOperationsRepository,
  DocumentSnapshotsRepository,
  DocumentsCommandUnitOfWork,
  DocumentsQueryRepository,
} from "./documents/application/ports";
import { createLifecycleService } from "./lifecycle/application";
import { createDefaultDocumentActionPolicyService } from "./lifecycle/application/policy/default-action-policy";
import type { LifecycleCommandUnitOfWork } from "./lifecycle/application/ports/lifecycle.uow";
import type {
  DocumentActionPolicyService,
  DocumentModuleRuntime,
  DocumentRegistry,
} from "./plugins";
import { createPostingService } from "./posting/application";
import type {
  DocumentsAccountingPeriodsPort,
  DocumentsAccountingPort,
  DocumentsLedgerReadPort,
  PostingCommandUnitOfWork,
} from "./posting/application/ports";
import {
  createNoopDocumentTransitionEffectsService,
  type DocumentTransitionEffectsService,
} from "./shared/application/transition-effects";

export type DocumentsModuleUnitOfWork = DocumentsCommandUnitOfWork &
  LifecycleCommandUnitOfWork &
  PostingCommandUnitOfWork;

export interface DocumentsModuleDeps {
  logger: Logger;
  now: Clock;
  generateUuid: UuidGenerator;
  accounting: DocumentsAccountingPort;
  accountingPeriods: DocumentsAccountingPeriodsPort;
  ledgerReadService: DocumentsLedgerReadPort;
  documentsQuery: DocumentsQueryRepository;
  documentEvents: Pick<DocumentEventsRepository, "listDocumentEvents">;
  documentLinks: Pick<DocumentLinksRepository, "listDocumentLinks">;
  documentOperations: Pick<
    DocumentOperationsRepository,
    "findPostingOperationId" | "listDocumentOperations"
  >;
  documentSnapshots: Pick<DocumentSnapshotsRepository, "findDocumentSnapshot">;
  moduleRuntime: DocumentModuleRuntime;
  registry: DocumentRegistry;
  policy?: DocumentActionPolicyService;
  transitionEffects?: DocumentTransitionEffectsService;
  unitOfWork: DocumentsModuleUnitOfWork;
}

export type DocumentsModule = ReturnType<typeof createDocumentsModule>;

export function createDocumentsModule(deps: DocumentsModuleDeps) {
  const createRuntime = (service: string) =>
    createModuleRuntime({
      logger: deps.logger,
      now: deps.now,
      generateUuid: deps.generateUuid,
      service,
    });
  const policy =
    deps.policy ?? createDefaultDocumentActionPolicyService();
  const transitionEffects =
    deps.transitionEffects ?? createNoopDocumentTransitionEffectsService();

  return {
    documents: createDocumentsService({
      runtime: createRuntime("documents.documents"),
      commandUow: deps.unitOfWork,
      accountingPeriods: deps.accountingPeriods,
      documentsQuery: deps.documentsQuery,
      documentEvents: deps.documentEvents,
      documentLinks: deps.documentLinks,
      documentOperations: deps.documentOperations,
      documentSnapshots: deps.documentSnapshots,
      ledgerReadService: deps.ledgerReadService,
      moduleRuntime: deps.moduleRuntime,
      registry: deps.registry,
      policy,
    }),
    lifecycle: createLifecycleService({
      runtime: createRuntime("documents.lifecycle"),
      commandUow: deps.unitOfWork,
      accountingPeriods: deps.accountingPeriods,
      registry: deps.registry,
      policy,
      transitionEffects,
    }),
    posting: createPostingService({
      runtime: createRuntime("documents.posting"),
      commandUow: deps.unitOfWork,
      accounting: deps.accounting,
      accountingPeriods: deps.accountingPeriods,
      registry: deps.registry,
      policy,
    }),
  };
}
