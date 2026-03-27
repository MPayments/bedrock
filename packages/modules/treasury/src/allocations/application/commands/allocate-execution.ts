import { invariant } from "@bedrock/shared/core/domain";

import type { TreasuryCoreServiceContext } from "../../../shared/application/core-context";
import { toAllocationDto, toObligationDto } from "../../../shared/application/mappers";
import { TreasuryEntityNotFoundError } from "../../../errors";
import {
  AllocateExecutionInputSchema,
  type AllocateExecutionInput,
} from "../../contracts";
import { assertAllocationValid } from "../../domain/allocation";
import { applyObligationAllocation } from "../../../obligations/domain/obligation";

export class AllocateExecutionCommand {
  constructor(private readonly context: TreasuryCoreServiceContext) {}

  async execute(input: AllocateExecutionInput) {
    const validated = AllocateExecutionInputSchema.parse(input);
    const allocatedMinor = BigInt(validated.allocatedMinor);

    assertAllocationValid({
      obligationId: validated.obligationId,
      executionEventId: validated.executionEventId,
      allocatedMinor,
    });

    const obligation = await this.context.reads.findObligation(
      validated.obligationId,
    );
    if (!obligation) {
      throw new TreasuryEntityNotFoundError("Obligation", validated.obligationId);
    }

    const executionEvent = await this.context.reads.findExecutionEvent(
      validated.executionEventId,
    );
    if (!executionEvent) {
      throw new TreasuryEntityNotFoundError(
        "ExecutionEvent",
        validated.executionEventId,
      );
    }

    invariant(
      executionEvent.eventKind === "settled" ||
        executionEvent.eventKind === "fee_charged" ||
        executionEvent.eventKind === "manual_adjustment",
      "only settled cash events can be allocated",
      {
        code: "treasury.allocation.event_kind_invalid",
      },
    );

    const instruction = await this.context.reads.findInstruction(
      executionEvent.instructionId,
    );
    if (!instruction) {
      throw new TreasuryEntityNotFoundError(
        "ExecutionInstruction",
        executionEvent.instructionId,
      );
    }

    const existingAllocations = await this.context.reads.listExecutionAllocations(
      executionEvent.id,
    );
    const allocatedSoFar = existingAllocations.reduce(
      (sum, row) => sum + row.allocatedMinor,
      0n,
    );

    invariant(
      allocatedSoFar + allocatedMinor <= instruction.amountMinor,
      "allocation exceeds executed amount",
      {
        code: "treasury.allocation.over_allocated_event",
      },
    );

    const nextObligation = applyObligationAllocation({
      obligation,
      allocatedMinor,
      now: this.context.runtime.now(),
    });

    const allocation = await this.context.unitOfWork.run(async (tx) => {
      const created = await tx.insertAllocation({
        id: this.context.runtime.generateUuid(),
        obligationId: obligation.id,
        executionEventId: executionEvent.id,
        allocatedMinor,
        allocationType: validated.allocationType,
      });

      await tx.updateObligation({
        id: nextObligation.id,
        settledMinor: nextObligation.settledMinor,
        updatedAt: nextObligation.updatedAt,
      });

      return created;
    });

    return {
      allocation: toAllocationDto(allocation),
      obligation: toObligationDto(nextObligation),
    };
  }
}
