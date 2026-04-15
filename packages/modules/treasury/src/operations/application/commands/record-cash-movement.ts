import { ValidationError } from "../../../errors";
import { TreasuryOperationNotFoundError } from "../../../errors";
import {
  RecordTreasuryCashMovementInputSchema,
  type RecordTreasuryCashMovementInput,
} from "../contracts/commands";
import type { TreasuryCashMovement } from "../contracts/dto";
import type {
  TreasuryCashMovementRecord,
  TreasuryCashMovementsRepository,
  TreasuryOperationsRepository,
} from "../ports/operations.repository";

function mapCashMovement(input: TreasuryCashMovementRecord): TreasuryCashMovement {
  return {
    accountRef: input.accountRef,
    amountMinor: input.amountMinor?.toString() ?? null,
    bookedAt: input.bookedAt,
    calculationSnapshotId: input.calculationSnapshotId,
    confirmedAt: input.confirmedAt,
    createdAt: input.createdAt,
    currencyId: input.currencyId,
    dealId: input.dealId,
    direction: input.direction,
    externalRecordId: input.externalRecordId,
    id: input.id,
    instructionId: input.instructionId,
    metadata: input.metadata,
    notes: input.notes,
    operationId: input.operationId,
    providerCounterpartyId: input.providerCounterpartyId,
    providerRef: input.providerRef,
    requisiteId: input.requisiteId,
    routeLegId: input.routeLegId,
    routeVersionId: input.routeVersionId,
    sourceKind: input.sourceKind,
    sourceRef: input.sourceRef,
    statementRef: input.statementRef,
    updatedAt: input.updatedAt,
    valueDate: input.valueDate,
  };
}

export class RecordTreasuryCashMovementCommand {
  constructor(
    private readonly cashMovementsRepository: TreasuryCashMovementsRepository,
    private readonly operationsRepository: TreasuryOperationsRepository,
    private readonly generateUuid: () => string,
    private readonly now: () => Date,
  ) {}

  async execute(
    raw: RecordTreasuryCashMovementInput,
  ): Promise<TreasuryCashMovement> {
    const validated = RecordTreasuryCashMovementInputSchema.parse(raw);
    const operation = await this.operationsRepository.findOperationById(
      validated.operationId,
    );

    if (!operation) {
      throw new TreasuryOperationNotFoundError(validated.operationId);
    }

    const currencyId = validated.currencyId ?? operation.currencyId;
    const routeLegId = validated.routeLegId ?? operation.routeLegId;

    if (validated.amountMinor !== null && currencyId === null) {
      throw new ValidationError(
        `Treasury cash movement ${validated.sourceRef} requires currencyId when amountMinor is set`,
      );
    }

    const inserted = await this.cashMovementsRepository.insertCashMovement({
      accountRef: validated.accountRef,
      amountMinor: validated.amountMinor,
      bookedAt: validated.bookedAt ?? this.now(),
      calculationSnapshotId: validated.calculationSnapshotId,
      confirmedAt: validated.confirmedAt,
      currencyId,
      dealId: operation.dealId,
      direction: validated.direction,
      externalRecordId: validated.externalRecordId,
      id: this.generateUuid(),
      instructionId: validated.instructionId,
      metadata: validated.metadata,
      notes: validated.notes,
      operationId: operation.id,
      providerCounterpartyId: validated.providerCounterpartyId,
      providerRef: validated.providerRef,
      requisiteId: validated.requisiteId,
      routeLegId,
      routeVersionId: validated.routeVersionId,
      sourceKind: validated.sourceKind,
      sourceRef: validated.sourceRef,
      statementRef: validated.statementRef,
      valueDate: validated.valueDate,
    });

    if (inserted) {
      return mapCashMovement(inserted);
    }

    const existing = await this.cashMovementsRepository.findCashMovementBySourceRef(
      validated.sourceRef,
    );

    if (!existing) {
      throw new Error(
        `Treasury cash movement ${validated.sourceRef} was not found after conflict`,
      );
    }

    return mapCashMovement(existing);
  }
}
