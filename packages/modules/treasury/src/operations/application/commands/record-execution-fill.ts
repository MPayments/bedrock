import { ValidationError } from "../../../errors";
import { TreasuryOperationNotFoundError } from "../../../errors";
import {
  RecordTreasuryExecutionFillInputSchema,
  type RecordTreasuryExecutionFillInput,
} from "../contracts/commands";
import type { TreasuryExecutionFill } from "../contracts/dto";
import type {
  TreasuryExecutionFillRecord,
  TreasuryExecutionFillsRepository,
  TreasuryOperationsRepository,
} from "../ports/operations.repository";

function mapExecutionFill(
  input: TreasuryExecutionFillRecord,
): TreasuryExecutionFill {
  return {
    actualRateDen: input.actualRateDen?.toString() ?? null,
    actualRateNum: input.actualRateNum?.toString() ?? null,
    boughtAmountMinor: input.boughtAmountMinor?.toString() ?? null,
    boughtCurrencyId: input.boughtCurrencyId,
    calculationSnapshotId: input.calculationSnapshotId,
    confirmedAt: input.confirmedAt,
    createdAt: input.createdAt,
    dealId: input.dealId,
    executedAt: input.executedAt,
    externalRecordId: input.externalRecordId,
    fillSequence: input.fillSequence,
    id: input.id,
    instructionId: input.instructionId,
    metadata: input.metadata,
    notes: input.notes,
    operationId: input.operationId,
    providerCounterpartyId: input.providerCounterpartyId,
    providerRef: input.providerRef,
    routeLegId: input.routeLegId,
    routeVersionId: input.routeVersionId,
    soldAmountMinor: input.soldAmountMinor?.toString() ?? null,
    soldCurrencyId: input.soldCurrencyId,
    sourceKind: input.sourceKind,
    sourceRef: input.sourceRef,
    updatedAt: input.updatedAt,
  };
}

export class RecordTreasuryExecutionFillCommand {
  constructor(
    private readonly fillsRepository: TreasuryExecutionFillsRepository,
    private readonly operationsRepository: TreasuryOperationsRepository,
    private readonly generateUuid: () => string,
    private readonly now: () => Date,
  ) {}

  async execute(
    raw: RecordTreasuryExecutionFillInput,
  ): Promise<TreasuryExecutionFill> {
    const validated = RecordTreasuryExecutionFillInputSchema.parse(raw);
    const operation = await this.operationsRepository.findOperationById(
      validated.operationId,
    );

    if (!operation) {
      throw new TreasuryOperationNotFoundError(validated.operationId);
    }

    const soldCurrencyId = validated.soldCurrencyId ?? operation.currencyId;
    const boughtCurrencyId =
      validated.boughtCurrencyId ?? operation.counterCurrencyId;
    const routeLegId = validated.routeLegId ?? operation.routeLegId;

    if (validated.soldAmountMinor !== null && soldCurrencyId === null) {
      throw new ValidationError(
        `Treasury execution fill ${validated.sourceRef} requires soldCurrencyId when soldAmountMinor is set`,
      );
    }

    if (validated.boughtAmountMinor !== null && boughtCurrencyId === null) {
      throw new ValidationError(
        `Treasury execution fill ${validated.sourceRef} requires boughtCurrencyId when boughtAmountMinor is set`,
      );
    }

    const inserted = await this.fillsRepository.insertFill({
      actualRateDen: validated.actualRateDen,
      actualRateNum: validated.actualRateNum,
      boughtAmountMinor: validated.boughtAmountMinor,
      boughtCurrencyId,
      calculationSnapshotId: validated.calculationSnapshotId,
      confirmedAt: validated.confirmedAt,
      dealId: operation.dealId,
      executedAt: validated.executedAt ?? this.now(),
      externalRecordId: validated.externalRecordId,
      fillSequence: validated.fillSequence,
      id: this.generateUuid(),
      instructionId: validated.instructionId,
      metadata: validated.metadata,
      notes: validated.notes,
      operationId: operation.id,
      providerCounterpartyId: validated.providerCounterpartyId,
      providerRef: validated.providerRef,
      routeLegId,
      routeVersionId: validated.routeVersionId,
      soldAmountMinor: validated.soldAmountMinor,
      soldCurrencyId,
      sourceKind: validated.sourceKind,
      sourceRef: validated.sourceRef,
    });

    if (inserted) {
      return mapExecutionFill(inserted);
    }

    const existing = await this.fillsRepository.findFillBySourceRef(
      validated.sourceRef,
    );

    if (!existing) {
      throw new Error(
        `Treasury execution fill ${validated.sourceRef} was not found after conflict`,
      );
    }

    return mapExecutionFill(existing);
  }
}
