import { closeDeal } from "./handlers/close-deal";
import { createLegOperation } from "./handlers/create-leg-operation";
import { requestExecution } from "./handlers/request-execution";
import { resolveExecutionBlocker } from "./handlers/resolve-blocker";
import type { DealExecutionWorkflowDeps } from "./shared/deps";

export type { DealExecutionWorkflowDeps } from "./shared/deps";
export {
  compileDealExecutionRecipe,
  type CompiledDealExecutionOperation,
  type DealExecutionAmountRef,
} from "./recipe";

export function createDealExecutionWorkflow(deps: DealExecutionWorkflowDeps) {
  return {
    closeDeal: (input: Parameters<typeof closeDeal>[1]) =>
      closeDeal(deps, input),
    createLegOperation: (input: Parameters<typeof createLegOperation>[1]) =>
      createLegOperation(deps, input),
    requestExecution: (input: Parameters<typeof requestExecution>[1]) =>
      requestExecution(deps, input),
    resolveExecutionBlocker: (
      input: Parameters<typeof resolveExecutionBlocker>[1],
    ) => resolveExecutionBlocker(deps, input),
  };
}

export type DealExecutionWorkflow = ReturnType<
  typeof createDealExecutionWorkflow
>;
