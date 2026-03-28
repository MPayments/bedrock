import { invariant } from "@bedrock/shared/core/domain";

import type { ExecutionEventKind, InstructionStatus } from "../../shared/domain/taxonomy";
import type { ExecutionInstructionRecord } from "../../shared/application/core-ports";

const TERMINAL_INSTRUCTION_STATUSES = new Set<InstructionStatus>([
  "settled",
  "failed",
  "returned",
  "void",
]);

const NON_LIFECYCLE_EVENT_KINDS = new Set<ExecutionEventKind>([
  "fee_charged",
  "manual_adjustment",
]);

export function resolveInstructionStatusFromEvent(
  currentStatus: InstructionStatus,
  eventKind: ExecutionEventKind,
): InstructionStatus {
  switch (eventKind) {
    case "submitted":
      return "submitted";
    case "accepted":
      return currentStatus === "partially_settled" ? currentStatus : "submitted";
    case "settled":
      return currentStatus === "submitted" ? "settled" : "settled";
    case "failed":
      return "failed";
    case "returned":
      return "returned";
    case "voided":
      return "void";
    case "fee_charged":
    case "manual_adjustment":
      return currentStatus;
  }
}

export function assertInstructionCanReceiveEvent(
  instruction: ExecutionInstructionRecord,
  eventKind: ExecutionEventKind,
) {
  if (NON_LIFECYCLE_EVENT_KINDS.has(eventKind)) {
    return;
  }

  invariant(
    !TERMINAL_INSTRUCTION_STATUSES.has(instruction.instructionStatus),
    "terminal instruction cannot receive lifecycle execution events",
    {
      code: "treasury.execution_instruction.invalid_event",
    },
  );
}
