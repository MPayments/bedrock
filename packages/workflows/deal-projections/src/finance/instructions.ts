import type { DealWorkflowProjection } from "@bedrock/deals/contracts";
import type {
  TreasuryInstruction,
  TreasuryOperationKind,
  TreasuryOperationProjectedState,
} from "@bedrock/treasury/contracts";

import type { TreasuryOperationRecord } from "../shared/deps";

export function getInstructionActions(input: {
  isBlockedWithoutInstruction: boolean;
  latestInstruction: TreasuryInstruction | null;
}) {
  const latestInstruction = input.latestInstruction;

  return {
    canPrepareInstruction:
      !latestInstruction && !input.isBlockedWithoutInstruction,
    canRequestReturn: latestInstruction?.state === "settled",
    canRetryInstruction:
      latestInstruction?.state === "failed" ||
      latestInstruction?.state === "returned",
    canSubmitInstruction: latestInstruction?.state === "prepared",
    canVoidInstruction:
      latestInstruction?.state === "prepared" ||
      latestInstruction?.state === "submitted",
  };
}

export function getInstructionStatus(input: {
  isBlockedWithoutInstruction: boolean;
  latestInstruction: TreasuryInstruction | null;
}) {
  if (input.latestInstruction) {
    return input.latestInstruction.state;
  }

  if (input.isBlockedWithoutInstruction) {
    return "blocked" as const;
  }

  return "planned" as const;
}

export function getAvailableOutcomeTransitions(
  latestInstruction: TreasuryInstruction | null,
): ("failed" | "returned" | "settled")[] {
  const submitTransitions: ("failed" | "returned" | "settled")[] = [
    "settled",
    "failed",
  ];
  const returnTransitions: ("failed" | "returned" | "settled")[] = ["returned"];

  if (!latestInstruction) {
    return [];
  }

  if (latestInstruction.state === "submitted") {
    return submitTransitions;
  }

  if (latestInstruction.state === "return_requested") {
    return returnTransitions;
  }

  return [];
}

export function buildFinanceDealOperation(input: {
  latestInstruction: TreasuryInstruction | null;
  operation: TreasuryOperationRecord;
  projectedState: TreasuryOperationProjectedState | null;
  queueBlocked: boolean;
}) {
  return {
    actions: getInstructionActions({
      isBlockedWithoutInstruction: input.queueBlocked,
      latestInstruction: input.latestInstruction,
    }),
    availableOutcomeTransitions: getAvailableOutcomeTransitions(
      input.latestInstruction,
    ),
    id: input.operation.id,
    instructionStatus: getInstructionStatus({
      isBlockedWithoutInstruction: input.queueBlocked,
      latestInstruction: input.latestInstruction,
    }),
    kind: input.operation.kind,
    latestInstruction: input.latestInstruction,
    operationHref: `/treasury/operations/${input.operation.id}`,
    projectedState: input.projectedState,
    sourceRef: input.operation.sourceRef,
    state: input.operation.state,
  };
}

export function resolveAdjustmentDocumentDocType(input: {
  operationKind: TreasuryOperationKind | null;
}) {
  if (!input.operationKind || input.operationKind === "fx_conversion") {
    return null;
  }

  return "transfer_resolution";
}

export function isExecutionRequestAllowed(workflow: DealWorkflowProjection) {
  if (
    workflow.summary.status === "awaiting_funds" ||
    workflow.summary.status === "awaiting_payment" ||
    workflow.summary.status === "closing_documents"
  ) {
    return true;
  }

  const readiness = workflow.transitionReadiness.find(
    (item) => item.targetStatus === "awaiting_funds",
  );

  return readiness?.allowed ?? false;
}
