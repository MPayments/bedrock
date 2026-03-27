import type {
  TreasuryCoreServiceContext,
} from "../../../shared/application/core-context";
import type {
  ExecutionEventRecord,
  TreasuryCoreTx,
  TreasuryOperationRecord,
} from "../../../shared/application/core-ports";
import type {
  BalanceState,
  ExecutionEventKind,
  LegKind,
  PositionKind,
} from "../../../shared/domain/taxonomy";

export function parseMinor(value: unknown) {
  if (typeof value === "string" && /^-?\d+$/.test(value)) {
    return BigInt(value);
  }

  if (typeof value === "number" && Number.isInteger(value)) {
    return BigInt(value);
  }

  return null;
}

function isFinalEvent(eventKind: string) {
  return ["settled", "failed", "returned", "voided"].includes(eventKind);
}

function supportsInTransitPosition(operationKind: string) {
  return [
    "intracompany_transfer",
    "intercompany_funding",
    "sweep",
    "fx_conversion",
  ].includes(operationKind);
}

export function buildPrincipalEntries(input: {
  operation: TreasuryOperationRecord;
  balanceState: BalanceState;
  eventId: string | null;
  instructionId: string | null;
  legKind?: LegKind;
  reverse?: boolean;
}) {
  const entries: {
    accountId: string;
    assetId: string;
    amountMinor: bigint;
    legKind: LegKind;
  }[] = [];
  const legKind = input.legKind ?? "principal";
  const sign = input.reverse ? -1n : 1n;

  switch (input.operation.operationKind) {
    case "collection":
      if (
        input.operation.sourceAccountId &&
        input.operation.sourceAssetId &&
        input.operation.sourceAmountMinor
      ) {
        entries.push({
          accountId: input.operation.sourceAccountId,
          assetId: input.operation.sourceAssetId,
          amountMinor: input.operation.sourceAmountMinor * sign,
          legKind,
        });
      }
      break;
    case "fx_conversion":
      if (
        input.operation.sourceAccountId &&
        input.operation.sourceAssetId &&
        input.operation.sourceAmountMinor
      ) {
        entries.push({
          accountId: input.operation.sourceAccountId,
          assetId: input.operation.sourceAssetId,
          amountMinor: -input.operation.sourceAmountMinor * sign,
          legKind: "fx_sell",
        });
      }

      if (
        input.operation.destinationAccountId &&
        input.operation.destinationAssetId &&
        input.operation.destinationAmountMinor
      ) {
        entries.push({
          accountId: input.operation.destinationAccountId,
          assetId: input.operation.destinationAssetId,
          amountMinor: input.operation.destinationAmountMinor * sign,
          legKind: "fx_buy",
        });
      }
      break;
    case "intracompany_transfer":
    case "intercompany_funding":
    case "sweep":
      if (
        input.operation.sourceAccountId &&
        input.operation.sourceAssetId &&
        input.operation.sourceAmountMinor
      ) {
        entries.push({
          accountId: input.operation.sourceAccountId,
          assetId: input.operation.sourceAssetId,
          amountMinor: -input.operation.sourceAmountMinor * sign,
          legKind,
        });
      }

      if (
        input.operation.destinationAccountId &&
        input.operation.destinationAssetId &&
        input.operation.destinationAmountMinor
      ) {
        entries.push({
          accountId: input.operation.destinationAccountId,
          assetId: input.operation.destinationAssetId,
          amountMinor: input.operation.destinationAmountMinor * sign,
          legKind,
        });
      }
      break;
    default:
      if (
        input.operation.sourceAccountId &&
        input.operation.sourceAssetId &&
        input.operation.sourceAmountMinor
      ) {
        entries.push({
          accountId: input.operation.sourceAccountId,
          assetId: input.operation.sourceAssetId,
          amountMinor: -input.operation.sourceAmountMinor * sign,
          legKind,
        });
      }
      break;
  }

  return entries.map((entry) => ({
    accountId: entry.accountId,
    assetId: entry.assetId,
    executionEventId: input.eventId,
    instructionId: input.instructionId,
    operationId: input.operation.id,
    balanceState: input.balanceState,
    legKind: entry.legKind,
    amountMinor: entry.amountMinor,
  }));
}

export async function upsertPosition(input: {
  tx: TreasuryCoreTx;
  context: TreasuryCoreServiceContext;
  originOperationId: string | null;
  positionKind: PositionKind;
  ownerEntityId: string;
  counterpartyEntityId: string | null;
  beneficialOwnerType: TreasuryOperationRecord["beneficialOwnerType"];
  beneficialOwnerId: string | null;
  assetId: string;
  amountMinor: bigint;
}) {
  const existing = await input.tx.findOpenPositionByKey({
    positionKind: input.positionKind,
    ownerEntityId: input.ownerEntityId,
    counterpartyEntityId: input.counterpartyEntityId,
    beneficialOwnerType: input.beneficialOwnerType,
    beneficialOwnerId: input.beneficialOwnerId,
    assetId: input.assetId,
  });

  if (existing) {
    await input.tx.updatePosition({
      id: existing.id,
      amountMinor: existing.amountMinor + input.amountMinor,
      settledMinor: existing.settledMinor,
      updatedAt: input.context.runtime.now(),
      closedAt: existing.closedAt,
    });

    return existing.id;
  }

  const created = await input.tx.insertPosition({
    id: input.context.runtime.generateUuid(),
    originOperationId: input.originOperationId,
    positionKind: input.positionKind,
    ownerEntityId: input.ownerEntityId,
    counterpartyEntityId: input.counterpartyEntityId,
    beneficialOwnerType: input.beneficialOwnerType,
    beneficialOwnerId: input.beneficialOwnerId,
    assetId: input.assetId,
    amountMinor: input.amountMinor,
  });

  return created.id;
}

export async function syncInTransitPosition(input: {
  tx: TreasuryCoreTx;
  context: TreasuryCoreServiceContext;
  operation: TreasuryOperationRecord;
  eventKind: ExecutionEventKind;
}) {
  if (
    !supportsInTransitPosition(input.operation.operationKind) ||
    !input.operation.sourceAssetId ||
    !input.operation.sourceAmountMinor
  ) {
    return;
  }

  const openPosition = await input.tx.findOpenPositionByOrigin({
    originOperationId: input.operation.id,
    positionKind: "in_transit",
    ownerEntityId: input.operation.executingEntityId,
  });

  if (input.eventKind === "submitted" || input.eventKind === "accepted") {
    if (!openPosition) {
      await input.tx.insertPosition({
        id: input.context.runtime.generateUuid(),
        originOperationId: input.operation.id,
        positionKind: "in_transit",
        ownerEntityId: input.operation.executingEntityId,
        counterpartyEntityId: null,
        beneficialOwnerType: null,
        beneficialOwnerId: null,
        assetId: input.operation.sourceAssetId,
        amountMinor: input.operation.sourceAmountMinor,
      });
    }

    return;
  }

  if (!openPosition || !isFinalEvent(input.eventKind)) {
    return;
  }

  await input.tx.updatePosition({
    id: openPosition.id,
    settledMinor: openPosition.amountMinor,
    updatedAt: input.context.runtime.now(),
    closedAt: input.context.runtime.now(),
  });
}

export async function openSettlementPositions(input: {
  tx: TreasuryCoreTx;
  context: TreasuryCoreServiceContext;
  operation: TreasuryOperationRecord;
}) {
  const amountMinor =
    input.operation.destinationAmountMinor ?? input.operation.sourceAmountMinor;
  const assetId =
    input.operation.destinationAssetId ?? input.operation.sourceAssetId;

  if (!amountMinor || !assetId) {
    return;
  }

  if (
    input.operation.operationKind === "collection" &&
    input.operation.beneficialOwnerType === "customer" &&
    input.operation.beneficialOwnerId
  ) {
    await upsertPosition({
      tx: input.tx,
      context: input.context,
      originOperationId: input.operation.id,
      positionKind: "customer_liability",
      ownerEntityId:
        input.operation.cashHolderEntityId ?? input.operation.executingEntityId,
      counterpartyEntityId: null,
      beneficialOwnerType: input.operation.beneficialOwnerType,
      beneficialOwnerId: input.operation.beneficialOwnerId,
      assetId,
      amountMinor,
    });
  }

  if (input.operation.settlementModel === "pobo") {
    await upsertPosition({
      tx: input.tx,
      context: input.context,
      originOperationId: input.operation.id,
      positionKind: "intercompany_due_from",
      ownerEntityId: input.operation.executingEntityId,
      counterpartyEntityId: input.operation.economicOwnerEntityId,
      beneficialOwnerType: null,
      beneficialOwnerId: null,
      assetId,
      amountMinor,
    });
    await upsertPosition({
      tx: input.tx,
      context: input.context,
      originOperationId: input.operation.id,
      positionKind: "intercompany_due_to",
      ownerEntityId: input.operation.economicOwnerEntityId,
      counterpartyEntityId: input.operation.executingEntityId,
      beneficialOwnerType: null,
      beneficialOwnerId: null,
      assetId,
      amountMinor,
    });
  }

  if (input.operation.settlementModel === "robo") {
    await upsertPosition({
      tx: input.tx,
      context: input.context,
      originOperationId: input.operation.id,
      positionKind: "intercompany_due_to",
      ownerEntityId:
        input.operation.cashHolderEntityId ?? input.operation.executingEntityId,
      counterpartyEntityId: input.operation.economicOwnerEntityId,
      beneficialOwnerType: null,
      beneficialOwnerId: null,
      assetId,
      amountMinor,
    });
    await upsertPosition({
      tx: input.tx,
      context: input.context,
      originOperationId: input.operation.id,
      positionKind: "intercompany_due_from",
      ownerEntityId: input.operation.economicOwnerEntityId,
      counterpartyEntityId:
        input.operation.cashHolderEntityId ?? input.operation.executingEntityId,
      beneficialOwnerType: null,
      beneficialOwnerId: null,
      assetId,
      amountMinor,
    });
  }

  if (input.operation.operationKind === "intercompany_funding") {
    await upsertPosition({
      tx: input.tx,
      context: input.context,
      originOperationId: input.operation.id,
      positionKind: "intercompany_due_from",
      ownerEntityId: input.operation.executingEntityId,
      counterpartyEntityId: input.operation.economicOwnerEntityId,
      beneficialOwnerType: null,
      beneficialOwnerId: null,
      assetId,
      amountMinor,
    });
    await upsertPosition({
      tx: input.tx,
      context: input.context,
      originOperationId: input.operation.id,
      positionKind: "intercompany_due_to",
      ownerEntityId: input.operation.economicOwnerEntityId,
      counterpartyEntityId: input.operation.executingEntityId,
      beneficialOwnerType: null,
      beneficialOwnerId: null,
      assetId,
      amountMinor,
    });
  }
}

export function buildBalanceEntriesForEvent(input: {
  context: TreasuryCoreServiceContext;
  operation: TreasuryOperationRecord;
  instructionId: string;
  eventId: string;
  eventKind: ExecutionEventKind;
  previousEventKinds: ExecutionEventKind[];
  metadata: Record<string, unknown> | null;
}) {
  const entries: {
    id: string;
    accountId: string;
    assetId: string;
    executionEventId: string | null;
    instructionId: string | null;
    operationId: string | null;
    balanceState: BalanceState;
    legKind: LegKind;
    amountMinor: bigint;
  }[] = [];

  const pendingAlreadyOpened = input.previousEventKinds.some(
    (eventKind) => eventKind === "submitted" || eventKind === "accepted",
  );
  const hasSettledBefore = input.previousEventKinds.includes("settled");

  if (
    (input.eventKind === "submitted" || input.eventKind === "accepted") &&
    !pendingAlreadyOpened
  ) {
    entries.push(
      ...buildPrincipalEntries({
        operation: input.operation,
        balanceState: "pending",
        eventId: input.eventId,
        instructionId: input.instructionId,
      }).map((entry) => ({
        ...entry,
        id: input.context.runtime.generateUuid(),
      })),
    );
  }

  if (input.eventKind === "settled") {
    if (pendingAlreadyOpened) {
      entries.push(
        ...buildPrincipalEntries({
          operation: input.operation,
          balanceState: "pending",
          eventId: input.eventId,
          instructionId: input.instructionId,
          reverse: true,
        }).map((entry) => ({
          ...entry,
          id: input.context.runtime.generateUuid(),
        })),
      );
    }

    if (
      input.operation.reservedAt &&
      input.operation.sourceAccountId &&
      input.operation.sourceAssetId &&
      input.operation.sourceAmountMinor
    ) {
      entries.push({
        id: input.context.runtime.generateUuid(),
        accountId: input.operation.sourceAccountId,
        assetId: input.operation.sourceAssetId,
        executionEventId: input.eventId,
        instructionId: input.instructionId,
        operationId: input.operation.id,
        balanceState: "reserved",
        legKind: "release",
        amountMinor: input.operation.sourceAmountMinor,
      });
    }

    entries.push(
      ...buildPrincipalEntries({
        operation: input.operation,
        balanceState: "booked",
        eventId: input.eventId,
        instructionId: input.instructionId,
      }).map((entry) => ({
        ...entry,
        id: input.context.runtime.generateUuid(),
      })),
    );

    const feeLines =
      (input.operation.payload?.feeLines as
        | { assetId?: string; amountMinor?: string; legKind?: LegKind }[]
        | undefined) ?? [];
    for (const feeLine of feeLines) {
      if (
        !input.operation.sourceAccountId ||
        !feeLine.assetId ||
        !feeLine.amountMinor
      ) {
        continue;
      }

      entries.push({
        id: input.context.runtime.generateUuid(),
        accountId: input.operation.sourceAccountId,
        assetId: feeLine.assetId,
        executionEventId: input.eventId,
        instructionId: input.instructionId,
        operationId: input.operation.id,
        balanceState: "booked",
        legKind: feeLine.legKind ?? "fee",
        amountMinor: -BigInt(feeLine.amountMinor),
      });
    }
  }

  if (input.eventKind === "failed" || input.eventKind === "voided") {
    if (pendingAlreadyOpened) {
      entries.push(
        ...buildPrincipalEntries({
          operation: input.operation,
          balanceState: "pending",
          eventId: input.eventId,
          instructionId: input.instructionId,
          reverse: true,
        }).map((entry) => ({
          ...entry,
          id: input.context.runtime.generateUuid(),
        })),
      );
    }

    if (
      input.operation.reservedAt &&
      input.operation.sourceAccountId &&
      input.operation.sourceAssetId &&
      input.operation.sourceAmountMinor
    ) {
      entries.push({
        id: input.context.runtime.generateUuid(),
        accountId: input.operation.sourceAccountId,
        assetId: input.operation.sourceAssetId,
        executionEventId: input.eventId,
        instructionId: input.instructionId,
        operationId: input.operation.id,
        balanceState: "reserved",
        legKind: "release",
        amountMinor: input.operation.sourceAmountMinor,
      });
    }
  }

  if (input.eventKind === "returned") {
    if (hasSettledBefore) {
      entries.push(
        ...buildPrincipalEntries({
          operation: input.operation,
          balanceState: "booked",
          eventId: input.eventId,
          instructionId: input.instructionId,
          reverse: true,
        }).map((entry) => ({
          ...entry,
          id: input.context.runtime.generateUuid(),
        })),
      );
    } else if (pendingAlreadyOpened) {
      entries.push(
        ...buildPrincipalEntries({
          operation: input.operation,
          balanceState: "pending",
          eventId: input.eventId,
          instructionId: input.instructionId,
          reverse: true,
        }).map((entry) => ({
          ...entry,
          id: input.context.runtime.generateUuid(),
        })),
      );
    }
  }

  if (input.eventKind === "fee_charged") {
    const amountMinor = parseMinor(input.metadata?.amountMinor);
    const assetId =
      typeof input.metadata?.assetId === "string"
        ? input.metadata.assetId
        : input.operation.sourceAssetId;

    if (input.operation.sourceAccountId && assetId && amountMinor) {
      entries.push({
        id: input.context.runtime.generateUuid(),
        accountId: input.operation.sourceAccountId,
        assetId,
        executionEventId: input.eventId,
        instructionId: input.instructionId,
        operationId: input.operation.id,
        balanceState: "booked",
        legKind: "fee",
        amountMinor: -amountMinor,
      });
    }
  }

  if (input.eventKind === "manual_adjustment") {
    const accountId =
      typeof input.metadata?.accountId === "string"
        ? input.metadata.accountId
        : input.operation.sourceAccountId;
    const assetId =
      typeof input.metadata?.assetId === "string"
        ? input.metadata.assetId
        : input.operation.sourceAssetId;
    const amountMinor = parseMinor(input.metadata?.amountMinor);
    const balanceState =
      input.metadata?.balanceState === "pending" ||
      input.metadata?.balanceState === "reserved" ||
      input.metadata?.balanceState === "booked"
        ? input.metadata.balanceState
        : "booked";
    const legKind =
      input.metadata?.legKind === "principal" ||
      input.metadata?.legKind === "fee" ||
      input.metadata?.legKind === "tax" ||
      input.metadata?.legKind === "reserve" ||
      input.metadata?.legKind === "release" ||
      input.metadata?.legKind === "fx_sell" ||
      input.metadata?.legKind === "fx_buy" ||
      input.metadata?.legKind === "network_fee" ||
      input.metadata?.legKind === "bank_fee"
        ? input.metadata.legKind
        : "principal";

    if (accountId && assetId && amountMinor) {
      entries.push({
        id: input.context.runtime.generateUuid(),
        accountId,
        assetId,
        executionEventId: input.eventId,
        instructionId: input.instructionId,
        operationId: input.operation.id,
        balanceState,
        legKind,
        amountMinor,
      });
    }
  }

  return entries;
}

export function buildExecutionEventRecord(input: {
  context: TreasuryCoreServiceContext;
  instructionId: string;
  eventKind: ExecutionEventKind;
  eventAt?: Date;
  externalRecordId?: string | null;
  metadata?: Record<string, unknown> | null;
}): ExecutionEventRecord {
  return {
    id: input.context.runtime.generateUuid(),
    instructionId: input.instructionId,
    eventKind: input.eventKind,
    eventAt: input.eventAt ?? input.context.runtime.now(),
    externalRecordId: input.externalRecordId ?? null,
    metadata: input.metadata ?? null,
    createdAt: input.context.runtime.now(),
  };
}
