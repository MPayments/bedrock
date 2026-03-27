import type {
  CounterpartyEndpoint,
  TreasuryAccount,
  TreasuryAccountBalance,
  TreasuryEndpoint,
} from "../../accounts/contracts";
import type { Allocation } from "../../allocations/contracts";
import type {
  ExecutionEvent,
  ExecutionInstruction,
  UnmatchedExternalRecord,
} from "../../executions/contracts";
import type {
  Obligation,
  ObligationOutstanding,
} from "../../obligations/contracts";
import type {
  OperationTimelineItem,
  TreasuryOperation,
} from "../../operations/contracts";
import type { TreasuryPosition } from "../../positions/contracts";
import type {
  AllocationRecord,
  CounterpartyEndpointRecord,
  ExecutionEventRecord,
  ExecutionInstructionRecord,
  ObligationRecord,
  TreasuryAccountBalanceRow,
  TreasuryAccountRecord,
  TreasuryEndpointRecord,
  TreasuryOperationRecord,
  TreasuryPositionRecord,
  UnmatchedExternalRecordRow,
} from "./core-ports";
import { computeAvailableBalance } from "../../accounts/domain/treasury-account";
import { computeOutstandingMinor } from "../../obligations/domain/obligation";

function stringifyMinor(
  value: bigint | null | undefined,
): string | null {
  return value == null ? null : value.toString();
}

export function toTreasuryAccountDto(
  record: TreasuryAccountRecord,
): TreasuryAccount {
  return {
    ...record,
  };
}

export function toTreasuryEndpointDto(
  record: TreasuryEndpointRecord,
): TreasuryEndpoint {
  return {
    ...record,
  };
}

export function toCounterpartyEndpointDto(
  record: CounterpartyEndpointRecord,
): CounterpartyEndpoint {
  return {
    ...record,
  };
}

export function toObligationDto(record: ObligationRecord): Obligation {
  return {
    ...record,
    amountMinor: record.amountMinor.toString(),
    settledMinor: record.settledMinor.toString(),
  };
}

export function toObligationOutstandingDto(
  record: ObligationRecord,
): ObligationOutstanding {
  return {
    obligationId: record.id,
    obligationKind: record.obligationKind,
    assetId: record.assetId,
    amountMinor: record.amountMinor.toString(),
    settledMinor: record.settledMinor.toString(),
    outstandingMinor: computeOutstandingMinor(record).toString(),
  };
}

export function toTreasuryOperationDto(
  record: TreasuryOperationRecord,
): TreasuryOperation {
  return {
    ...record,
    sourceAmountMinor: stringifyMinor(record.sourceAmountMinor),
    destinationAmountMinor: stringifyMinor(record.destinationAmountMinor),
  };
}

export function toExecutionInstructionDto(
  record: ExecutionInstructionRecord,
): ExecutionInstruction {
  return {
    ...record,
    amountMinor: record.amountMinor.toString(),
  };
}

export function toExecutionEventDto(
  record: ExecutionEventRecord,
): ExecutionEvent {
  return {
    ...record,
  };
}

export function toAllocationDto(record: AllocationRecord): Allocation {
  return {
    ...record,
    allocatedMinor: record.allocatedMinor.toString(),
  };
}

export function toTreasuryPositionDto(
  record: TreasuryPositionRecord,
): TreasuryPosition {
  return {
    ...record,
    amountMinor: record.amountMinor.toString(),
    settledMinor: record.settledMinor.toString(),
  };
}

export function toTreasuryAccountBalanceDto(
  row: TreasuryAccountBalanceRow,
): TreasuryAccountBalance {
  return {
    accountId: row.accountId,
    assetId: row.assetId,
    pendingMinor: row.pendingMinor.toString(),
    reservedMinor: row.reservedMinor.toString(),
    bookedMinor: row.bookedMinor.toString(),
    availableMinor: computeAvailableBalance(row).toString(),
  };
}

export function toOperationTimelineItemDto(input: {
  operation: TreasuryOperationRecord;
  obligations: ObligationRecord[];
  instructions: ExecutionInstructionRecord[];
  events: ExecutionEventRecord[];
  positions: TreasuryPositionRecord[];
}): OperationTimelineItem {
  return {
    operation: toTreasuryOperationDto(input.operation),
    obligations: input.obligations.map((record) => record.id),
    obligationItems: input.obligations.map(toObligationDto),
    instructions: input.instructions.map((record) => record.id),
    instructionItems: input.instructions.map(toExecutionInstructionDto),
    events: input.events.map((record) => record.id),
    eventItems: input.events.map(toExecutionEventDto),
    positions: input.positions.map((record) => record.id),
    positionItems: input.positions.map(toTreasuryPositionDto),
  };
}

export function toUnmatchedExternalRecordDto(
  record: UnmatchedExternalRecordRow,
): UnmatchedExternalRecord {
  return {
    ...record,
    recordKind: record.recordKind as UnmatchedExternalRecord["recordKind"],
  };
}
