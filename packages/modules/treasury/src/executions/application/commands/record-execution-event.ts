import type { TreasuryCoreServiceContext } from "../../../shared/application/core-context";
import { toExecutionEventDto, toTreasuryOperationDto } from "../../../shared/application/mappers";
import { TreasuryEntityNotFoundError } from "../../../errors";
import {
  RecordExecutionEventInputSchema,
  type RecordExecutionEventInput,
} from "../../contracts";
import { assertExecutionEventValid } from "../../domain/execution-event";
import {
  assertInstructionCanReceiveEvent,
  resolveInstructionStatusFromEvent,
} from "../../domain/execution-instruction";
import {
  applyOperationExecutionEvent,
  assertOperationCanReceiveExecutionEvent,
} from "../../../operations/domain/treasury-operation";
import {
  buildBalanceEntriesForEvent,
  buildExecutionEventRecord,
  openSettlementPositions,
  syncInTransitPosition,
} from "../shared/execution-support";

export class RecordExecutionEventCommand {
  constructor(private readonly context: TreasuryCoreServiceContext) {}

  async execute(input: RecordExecutionEventInput) {
    const validated = RecordExecutionEventInputSchema.parse(input);
    const instruction = await this.context.reads.findInstruction(validated.instructionId);
    if (!instruction) {
      throw new TreasuryEntityNotFoundError(
        "ExecutionInstruction",
        validated.instructionId,
      );
    }

    const operation = await this.context.reads.findOperation(instruction.operationId);
    if (!operation) {
      throw new TreasuryEntityNotFoundError("Operation", instruction.operationId);
    }

    assertInstructionCanReceiveEvent(instruction, validated.eventKind);
    assertOperationCanReceiveExecutionEvent(operation, validated.eventKind);

    const previousEvents = await this.context.reads.listInstructionEvents(
      instruction.id,
    );

    const event = buildExecutionEventRecord({
      context: this.context,
      instructionId: instruction.id,
      eventKind: validated.eventKind,
      eventAt: validated.eventAt,
      externalRecordId: validated.externalRecordId,
      metadata: validated.metadata,
    });
    assertExecutionEventValid(event);

    const nextInstructionStatus = resolveInstructionStatusFromEvent(
      instruction.instructionStatus,
      event.eventKind,
    );

    const result = await this.context.unitOfWork.run(async (tx) => {
      const createdEvent = await tx.insertExecutionEvent({
        id: event.id,
        instructionId: event.instructionId,
        eventKind: event.eventKind,
        eventAt: event.eventAt,
        externalRecordId: event.externalRecordId,
        metadata: event.metadata,
      });

      if (createdEvent.externalRecordId) {
        await tx.resolveOpenExceptionsForExternalRecord({
          externalRecordId: createdEvent.externalRecordId,
          resolvedAt: this.context.runtime.now(),
        });
      }

      await tx.updateExecutionInstructionStatus({
        id: instruction.id,
        instructionStatus: nextInstructionStatus,
        updatedAt: this.context.runtime.now(),
      });

      const instructionStatuses = (
        await tx.listOperationInstructions(operation.id)
      ).map((item) =>
        item.id === instruction.id ? nextInstructionStatus : item.instructionStatus,
      );
      const nextOperation = applyOperationExecutionEvent({
        operation,
        eventKind: event.eventKind,
        instructionStatuses,
        now: this.context.runtime.now(),
      });

      await tx.updateOperationStatus({
        id: nextOperation.id,
        instructionStatus: nextOperation.instructionStatus,
        updatedAt: nextOperation.updatedAt,
        approvedAt: nextOperation.approvedAt,
        reservedAt: nextOperation.reservedAt,
      });

      const balanceEntries = buildBalanceEntriesForEvent({
        context: this.context,
        operation,
        instructionId: instruction.id,
        eventId: createdEvent.id,
        eventKind: createdEvent.eventKind,
        previousEventKinds: previousEvents.map((item) => item.eventKind),
        metadata: createdEvent.metadata,
      });
      await tx.insertAccountBalanceEntries(balanceEntries);

      await syncInTransitPosition({
        tx,
        context: this.context,
        operation,
        eventKind: createdEvent.eventKind,
      });

      if (createdEvent.eventKind === "settled") {
        await openSettlementPositions({
          tx,
          context: this.context,
          operation,
        });
      }

      return {
        event: createdEvent,
        operation: nextOperation,
      };
    });

    return {
      event: toExecutionEventDto(result.event),
      operation: toTreasuryOperationDto(result.operation),
    };
  }
}
