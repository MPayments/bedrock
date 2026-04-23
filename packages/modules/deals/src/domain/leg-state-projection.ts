import type { DEAL_LEG_STATE_VALUES } from "./constants";
import type { DealLegKind } from "../application/contracts/zod";

type InstructionState =
  | "prepared"
  | "submitted"
  | "settled"
  | "failed"
  | "voided"
  | "return_requested"
  | "returned";

export type DealLegManualOverride = "blocked" | "skipped";
export type ComputedDealLegState = (typeof DEAL_LEG_STATE_VALUES)[number];

export interface ComputeDealLegStateInput {
  manualOverride: DealLegManualOverride | null;
  operationRefs: readonly { readonly operationId: string }[];
  latestInstructionStateByOperationId: ReadonlyMap<string, InstructionState>;
  requiredDocType: string | null;
  postedDocTypes: ReadonlySet<string>;
}

export function computeDealLegState(
  input: ComputeDealLegStateInput,
): ComputedDealLegState {
  if (input.manualOverride !== null) {
    return input.manualOverride;
  }

  if (input.operationRefs.length === 0) {
    return "pending";
  }

  // Grab the latest instruction state for every operation. If any operation
  // has no instruction, treat the leg as still `pending` — nothing has been
  // prepared for that op yet.
  const instructionStates: InstructionState[] = [];
  for (const ref of input.operationRefs) {
    const state = input.latestInstructionStateByOperationId.get(
      ref.operationId,
    );
    if (!state) return "pending";
    instructionStates.push(state);
  }

  const allSettled = instructionStates.every((s) => s === "settled");
  if (allSettled) {
    const docGateSatisfied =
      input.requiredDocType === null ||
      input.postedDocTypes.has(input.requiredDocType);
    return docGateSatisfied ? "done" : "in_progress";
  }

  const FORWARD_STATES: ReadonlySet<InstructionState> = new Set([
    "prepared",
    "submitted",
    "settled",
  ]);
  const allForward = instructionStates.every((s) => FORWARD_STATES.has(s));
  if (!allForward) return "pending";

  const allSubmittedOrBetter = instructionStates.every(
    (s) => s === "submitted" || s === "settled",
  );
  if (allSubmittedOrBetter) return "in_progress";

  const allPreparedOrBetter = instructionStates.every((s) =>
    FORWARD_STATES.has(s),
  );
  return allPreparedOrBetter ? "ready" : "pending";
}

export function getRequiredDocTypeForLegKind(
  legKind: DealLegKind,
  legKindMap: Record<DealLegKind, string | null>,
): string | null {
  return legKindMap[legKind];
}
