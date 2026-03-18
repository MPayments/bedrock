import type { Logger } from "@bedrock/platform/observability/logger";

import type {
  DocumentActionPolicyService,
  DocumentModuleRuntime,
  DocumentRegistry,
} from "../plugins";
import type {
  DocumentEventsRepository,
  DocumentLinksRepository,
  DocumentOperationsRepository,
  DocumentSnapshotsRepository,
  DocumentsQueryRepository,
} from "./documents/ports";
import type {
  DocumentsAccountingPeriodsPort,
  DocumentsAccountingPort,
  DocumentsLedgerReadPort,
} from "./posting/ports";
import type { DocumentsTransactionsPort } from "./shared/external-ports";
import type { DocumentTransitionEffectsService } from "./shared/transition-effects";

export interface DocumentsServiceDeps {
  accounting: DocumentsAccountingPort;
  accountingPeriods: DocumentsAccountingPeriodsPort;
  documentEvents: DocumentEventsRepository;
  documentLinks: DocumentLinksRepository;
  documentOperations: DocumentOperationsRepository;
  documentSnapshots: DocumentSnapshotsRepository;
  documentsQuery: DocumentsQueryRepository;
  ledgerReadService: DocumentsLedgerReadPort;
  moduleRuntime: DocumentModuleRuntime;
  policy?: DocumentActionPolicyService;
  transitionEffects?: DocumentTransitionEffectsService;
  registry: DocumentRegistry;
  transactions: DocumentsTransactionsPort;
  logger?: Logger;
  now?: () => Date;
}
