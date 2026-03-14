import type { Logger } from "@bedrock/platform/observability/logger";

import type {
  DocumentsAccountingPeriodsPort,
  DocumentsAccountingPort,
  DocumentsLedgerReadPort,
  DocumentsRepository,
  DocumentsTransactionsPort,
} from "./ports";
import type {
  DocumentActionPolicyService,
  DocumentModuleRuntime,
  DocumentRegistry,
} from "../plugins";

export interface DocumentsServiceDeps {
  accounting: DocumentsAccountingPort;
  accountingPeriods: DocumentsAccountingPeriodsPort;
  ledgerReadService: DocumentsLedgerReadPort;
  moduleRuntime: DocumentModuleRuntime;
  policy?: DocumentActionPolicyService;
  repository: DocumentsRepository;
  registry: DocumentRegistry;
  transactions: DocumentsTransactionsPort;
  logger?: Logger;
}
