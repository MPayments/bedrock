import { invariant } from "@bedrock/shared/core/domain";

import type { ExecutionEventKind, InstructionStatus } from "../../shared/domain/taxonomy";
import type { ExecutionInstructionRecord } from "../../shared/application/core-ports";

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
  invariant(
    instruction.instructionStatus !== "void" || eventKind === "manual_adjustment",
    "void instruction cannot receive this event",
    {
      code: "treasury.execution_instruction.invalid_event",
    },
  );
}
