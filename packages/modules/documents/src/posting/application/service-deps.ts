import type { ModuleRuntime } from "@bedrock/shared/core";

import type { PostingCommandUnitOfWork } from "./ports";
import type {
  DocumentsAccountingPeriodsPort,
  DocumentsAccountingPort,
} from "./ports";
import type { DocumentActionPolicyService, DocumentRegistry } from "../../plugins";

export interface PostingServiceDeps {
  runtime: ModuleRuntime;
  commandUow: PostingCommandUnitOfWork;
  accounting: DocumentsAccountingPort;
  accountingPeriods: DocumentsAccountingPeriodsPort;
  registry: DocumentRegistry;
  policy: DocumentActionPolicyService;
}
