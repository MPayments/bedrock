import { DomainError, invariant } from "@bedrock/shared/core/domain";

import type { IssueOperationInput } from "../contracts";
import type { ExecutionEventKind } from "../../shared/domain/taxonomy";
import type { TreasuryOperationRecord } from "../../shared/application/core-ports";

const TERMINAL_OPERATION_STATUSES = new Set<
  TreasuryOperationRecord["instructionStatus"]
>(["settled", "failed", "returned", "void"]);

const NON_LIFECYCLE_EVENT_KINDS = new Set<ExecutionEventKind>([
  "fee_charged",
  "manual_adjustment",
]);

export function resolveSettlementModel(input: {
  operationKind: IssueOperationInput["operationKind"];
  economicOwnerEntityId: string;
  executingEntityId: string;
  cashHolderEntityId?: string | null;
}) {
  if (
    input.operationKind === "payout" &&
    input.executingEntityId !== input.economicOwnerEntityId
  ) {
    return "pobo" as const;
  }

  if (
    input.operationKind === "collection" &&
    (input.cashHolderEntityId ?? input.executingEntityId) !==
      input.economicOwnerEntityId
  ) {
    return "robo" as const;
  }

  return "direct" as const;
}

export function normalizeOperationRecord(
  input: IssueOperationInput,
): Omit<
  TreasuryOperationRecord,
  "id" | "createdAt" | "updatedAt" | "approvedAt" | "reservedAt"
> {
  if (
    input.operationKind === "intracompany_transfer" ||
    input.operationKind === "sweep"
  ) {
    invariant(
      input.executingEntityId === input.economicOwnerEntityId,
      `${input.operationKind} must stay within one legal entity`,
      {
        code: "treasury.operation.same_entity_required",
      },
    );
  }

  if (input.operationKind === "intercompany_funding") {
    invariant(
      input.executingEntityId !== input.economicOwnerEntityId,
      "intercompany_funding requires different economic and executing entities",
      {
        code: "treasury.operation.intercompany_entities_required",
      },
    );
  }

  const settlementModel = resolveSettlementModel({
    operationKind: input.operationKind,
    economicOwnerEntityId: input.economicOwnerEntityId,
    executingEntityId: input.executingEntityId,
    cashHolderEntityId:
      "cashHolderEntityId" in input ? input.cashHolderEntityId : null,
  });

  switch (input.operationKind) {
    case "fx_conversion":
      return {
        idempotencyKey: input.idempotencyKey,
        operationKind: input.operationKind,
        economicOwnerEntityId: input.economicOwnerEntityId,
        executingEntityId: input.executingEntityId,
        cashHolderEntityId: input.cashHolderEntityId ?? input.executingEntityId,
        beneficialOwnerType: input.beneficialOwnerType ?? null,
        beneficialOwnerId: input.beneficialOwnerId ?? null,
        legalBasis: null,
        settlementModel,
        instructionStatus: "draft",
        sourceAccountId: input.sourceAccountId,
        destinationAccountId: input.destinationAccountId,
        sourceAssetId: input.sourceAssetId,
        destinationAssetId: input.destinationAssetId,
        sourceAmountMinor: BigInt(input.sourceAmountMinor),
        destinationAmountMinor: BigInt(input.destinationAmountMinor),
        memo: input.memo ?? null,
        payload: {
          quoteSnapshot: input.quoteSnapshot,
          feeLines: input.feeLines,
        },
      };
    case "intracompany_transfer":
    case "intercompany_funding":
    case "sweep":
      return {
        idempotencyKey: input.idempotencyKey,
        operationKind: input.operationKind,
        economicOwnerEntityId: input.economicOwnerEntityId,
        executingEntityId: input.executingEntityId,
        cashHolderEntityId: input.cashHolderEntityId ?? input.executingEntityId,
        beneficialOwnerType: input.beneficialOwnerType ?? null,
        beneficialOwnerId: input.beneficialOwnerId ?? null,
        legalBasis: input.operationKind === "intercompany_funding" ? input.legalBasis : null,
        settlementModel,
        instructionStatus: "draft",
        sourceAccountId: input.sourceAccountId,
        destinationAccountId: input.destinationAccountId,
        sourceAssetId: input.assetId,
        destinationAssetId: input.assetId,
        sourceAmountMinor: BigInt(input.amountMinor),
        destinationAmountMinor: BigInt(input.amountMinor),
        memo: input.memo ?? null,
        payload: null,
      };
    default:
      return {
        idempotencyKey: input.idempotencyKey,
        operationKind: input.operationKind,
        economicOwnerEntityId: input.economicOwnerEntityId,
        executingEntityId: input.executingEntityId,
        cashHolderEntityId: input.cashHolderEntityId ?? input.executingEntityId,
        beneficialOwnerType: input.beneficialOwnerType ?? null,
        beneficialOwnerId: input.beneficialOwnerId ?? null,
        legalBasis: "legalBasis" in input ? input.legalBasis ?? null : null,
        settlementModel,
        instructionStatus: "draft",
        sourceAccountId: input.sourceAccountId,
        destinationAccountId: null,
        sourceAssetId: input.assetId,
        destinationAssetId: input.assetId,
        sourceAmountMinor: BigInt(input.amountMinor),
        destinationAmountMinor: BigInt(input.amountMinor),
        memo: input.memo ?? null,
        payload: null,
      };
  }
}

export function assertOperationRelatedStateValid(input: {
  destinationAccountAssetId?: string | null;
  obligationAssetIds?: string[];
  operation: Pick<
    TreasuryOperationRecord,
    | "destinationAssetId"
    | "operationKind"
    | "sourceAssetId"
  >;
  sourceAccountAssetId?: string | null;
}) {
  if (input.operation.sourceAssetId && input.sourceAccountAssetId) {
    invariant(
      input.sourceAccountAssetId === input.operation.sourceAssetId,
      "source account asset must match operation source asset",
      {
        code: "treasury.operation.source_account_asset_mismatch",
      },
    );
  }

  if (input.operation.destinationAssetId && input.destinationAccountAssetId) {
    invariant(
      input.destinationAccountAssetId === input.operation.destinationAssetId,
      "destination account asset must match operation destination asset",
      {
        code: "treasury.operation.destination_account_asset_mismatch",
      },
    );
  }

  if (
    input.operation.operationKind !== "fx_conversion" &&
    input.operation.sourceAssetId &&
    input.destinationAccountAssetId &&
    input.destinationAccountAssetId !== input.operation.sourceAssetId
  ) {
    invariant(
      false,
      `${input.operation.operationKind} cannot change asset; use fx_conversion instead`,
      {
        code: "treasury.operation.cross_asset_requires_fx",
      },
    );
  }

  for (const obligationAssetId of input.obligationAssetIds ?? []) {
    if (!input.operation.sourceAssetId) {
      continue;
    }

    invariant(
      obligationAssetId === input.operation.sourceAssetId,
      "linked obligation asset must match operation asset",
      {
        code: "treasury.operation.obligation_asset_mismatch",
      },
    );
  }
}

export function applyOperationApproval(
  operation: TreasuryOperationRecord,
  now: Date,
) {
  invariant(operation.instructionStatus === "draft", "operation must be draft", {
    code: "treasury.operation.approve_invalid_state",
  });

  return {
    ...operation,
    instructionStatus: "approved" as const,
    approvedAt: now,
    updatedAt: now,
  };
}

export function applyOperationReservation(
  operation: TreasuryOperationRecord,
  now: Date,
) {
  invariant(
    operation.instructionStatus === "approved",
    "operation must be approved before reservation",
    {
      code: "treasury.operation.reserve_invalid_state",
    },
  );

  return {
    ...operation,
    instructionStatus: "reserved" as const,
    reservedAt: now,
    updatedAt: now,
  };
}

export function applyOperationExecutionEvent(input: {
  operation: TreasuryOperationRecord;
  eventKind: ExecutionEventKind;
  instructionStatuses: string[];
  now: Date;
}) {
  const allInstructionsVoided =
    input.instructionStatuses.length > 0 &&
    input.instructionStatuses.every((status) => status === "void");
  const allInstructionsSettled =
    input.instructionStatuses.length > 0 &&
    input.instructionStatuses.every((status) => status === "settled");
  const nextStatus = input.instructionStatuses.includes("failed")
    ? "failed"
    : input.instructionStatuses.includes("returned")
      ? "returned"
      : allInstructionsVoided
        ? "void"
        : allInstructionsSettled
        ? "settled"
        : input.instructionStatuses.includes("submitted") ||
            input.instructionStatuses.includes("accepted")
          ? "submitted"
          : input.operation.instructionStatus;

  if (nextStatus === input.operation.instructionStatus) {
    return input.operation;
  }

  return {
    ...input.operation,
    instructionStatus: nextStatus,
    updatedAt: input.now,
  };
}

export function assertOperationSupportsInstructionCreation(
  operation: TreasuryOperationRecord,
) {
  invariant(
    operation.instructionStatus === "approved" ||
      operation.instructionStatus === "reserved",
    "operation must be approved or reserved before creating an execution instruction",
    {
      code: "treasury.operation.instruction_invalid_state",
    },
  );
}

export function assertOperationCanReceiveExecutionEvent(
  operation: TreasuryOperationRecord,
  eventKind: ExecutionEventKind,
) {
  if (NON_LIFECYCLE_EVENT_KINDS.has(eventKind)) {
    return;
  }

  if (TERMINAL_OPERATION_STATUSES.has(operation.instructionStatus)) {
    throw new DomainError(
      "treasury.operation.terminal",
      "terminal operation cannot receive lifecycle execution events",
      {
        eventKind,
        operationId: operation.id,
        operationStatus: operation.instructionStatus,
      },
    );
  }
}
