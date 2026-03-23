import type { ModuleRuntime } from "@bedrock/shared/core";

import type { LifecycleCommandUnitOfWork } from "./ports/lifecycle.uow";
import type { DocumentActionPolicyService, DocumentRegistry } from "../../plugins";
import type { DocumentsAccountingPeriodsPort } from "../../posting/application/ports";
import type { DocumentTransitionEffectsService } from "../../shared/application/transition-effects";

export interface LifecycleServiceDeps {
  runtime: ModuleRuntime;
  commandUow: LifecycleCommandUnitOfWork;
  accountingPeriods: DocumentsAccountingPeriodsPort;
  registry: DocumentRegistry;
  policy: DocumentActionPolicyService;
  transitionEffects: DocumentTransitionEffectsService;
}
