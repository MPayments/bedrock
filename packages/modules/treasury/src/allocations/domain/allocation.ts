import { invariant } from "@bedrock/shared/core/domain";

export function assertAllocationValid(input: {
  obligationId: string;
  executionEventId: string;
  allocatedMinor: bigint;
}) {
  invariant(input.obligationId.trim().length > 0, "obligationId is required", {
    code: "treasury.allocation.obligation_required",
  });
  invariant(
    input.executionEventId.trim().length > 0,
    "executionEventId is required",
    {
      code: "treasury.allocation.execution_event_required",
    },
  );
  invariant(input.allocatedMinor > 0n, "allocatedMinor must be positive", {
    code: "treasury.allocation.amount_positive",
  });
}
