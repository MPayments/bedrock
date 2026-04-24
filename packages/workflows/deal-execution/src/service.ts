import { closeDeal } from "./handlers/close-deal";
import { createLegOperation } from "./handlers/create-leg-operation";
import {
  prepareInstruction,
  recordInstructionOutcome,
  requestReturn,
  retryInstruction,
  submitInstruction,
  voidInstruction,
} from "./handlers/instructions";
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
    prepareInstruction: (input: Parameters<typeof prepareInstruction>[1]) =>
      prepareInstruction(deps, input),
    recordInstructionOutcome: (
      input: Parameters<typeof recordInstructionOutcome>[1],
    ) => recordInstructionOutcome(deps, input),
    requestExecution: (input: Parameters<typeof requestExecution>[1]) =>
      requestExecution(deps, input),
    requestReturn: (input: Parameters<typeof requestReturn>[1]) =>
      requestReturn(deps, input),
    resolveExecutionBlocker: (
      input: Parameters<typeof resolveExecutionBlocker>[1],
    ) => resolveExecutionBlocker(deps, input),
    retryInstruction: (input: Parameters<typeof retryInstruction>[1]) =>
      retryInstruction(deps, input),
    submitInstruction: (input: Parameters<typeof submitInstruction>[1]) =>
      submitInstruction(deps, input),
    voidInstruction: (input: Parameters<typeof voidInstruction>[1]) =>
      voidInstruction(deps, input),
  };
}

export type DealExecutionWorkflow = ReturnType<
  typeof createDealExecutionWorkflow
>;
