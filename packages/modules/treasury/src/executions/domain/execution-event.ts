import { invariant } from "@bedrock/shared/core/domain";

export function assertExecutionEventValid<T extends {
  instructionId: string;
  eventKind: string;
}>(input: T): T {
  invariant(input.instructionId.trim().length > 0, "instructionId is required", {
    code: "treasury.execution_event.instruction_required",
  });
  invariant(input.eventKind.trim().length > 0, "eventKind is required", {
    code: "treasury.execution_event.kind_required",
  });

  return input;
}
