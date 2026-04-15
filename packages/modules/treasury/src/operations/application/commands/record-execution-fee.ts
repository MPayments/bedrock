import { ValidationError } from "../../../errors";
import { TreasuryOperationNotFoundError } from "../../../errors";
import {
  RecordTreasuryExecutionFeeInputSchema,
  type RecordTreasuryExecutionFeeInput,
} from "../contracts/commands";
import type { TreasuryExecutionFee } from "../contracts/dto";
import type {
  TreasuryExecutionFeeRecord,
  TreasuryExecutionFeesRepository,
  TreasuryOperationsRepository,
} from "../ports/operations.repository";

function mapExecutionFee(input: TreasuryExecutionFeeRecord): TreasuryExecutionFee {
  return {
    amountMinor: input.amountMinor?.toString() ?? null,
    calculationSnapshotId: input.calculationSnapshotId,
    chargedAt: input.chargedAt,
    componentCode: input.componentCode,
    confirmedAt: input.confirmedAt,
    createdAt: input.createdAt,
    currencyId: input.currencyId,
    dealId: input.dealId,
    externalRecordId: input.externalRecordId,
    feeFamily: input.feeFamily,
    fillId: input.fillId,
    id: input.id,
    instructionId: input.instructionId,
    metadata: input.metadata,
    notes: input.notes,
    operationId: input.operationId,
    providerCounterpartyId: input.providerCounterpartyId,
    providerRef: input.providerRef,
    routeComponentId: input.routeComponentId,
    routeLegId: input.routeLegId,
    routeVersionId: input.routeVersionId,
    sourceKind: input.sourceKind,
    sourceRef: input.sourceRef,
    updatedAt: input.updatedAt,
  };
}

export class RecordTreasuryExecutionFeeCommand {
  constructor(
    private readonly feesRepository: TreasuryExecutionFeesRepository,
    private readonly operationsRepository: TreasuryOperationsRepository,
    private readonly generateUuid: () => string,
    private readonly now: () => Date,
  ) {}

  async execute(
    raw: RecordTreasuryExecutionFeeInput,
  ): Promise<TreasuryExecutionFee> {
    const validated = RecordTreasuryExecutionFeeInputSchema.parse(raw);
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
        `Treasury execution fee ${validated.sourceRef} requires currencyId when amountMinor is set`,
      );
    }

    const inserted = await this.feesRepository.insertFee({
      amountMinor: validated.amountMinor,
      calculationSnapshotId: validated.calculationSnapshotId,
      chargedAt: validated.chargedAt ?? this.now(),
      componentCode: validated.componentCode,
      confirmedAt: validated.confirmedAt,
      currencyId,
      dealId: operation.dealId,
      externalRecordId: validated.externalRecordId,
      feeFamily: validated.feeFamily,
      fillId: validated.fillId,
      id: this.generateUuid(),
      instructionId: validated.instructionId,
      metadata: validated.metadata,
      notes: validated.notes,
      operationId: operation.id,
      providerCounterpartyId: validated.providerCounterpartyId,
      providerRef: validated.providerRef,
      routeComponentId: validated.routeComponentId,
      routeLegId,
      routeVersionId: validated.routeVersionId,
      sourceKind: validated.sourceKind,
      sourceRef: validated.sourceRef,
    });

    if (inserted) {
      return mapExecutionFee(inserted);
    }

    const existing = await this.feesRepository.findFeeBySourceRef(
      validated.sourceRef,
    );

    if (!existing) {
      throw new Error(
        `Treasury execution fee ${validated.sourceRef} was not found after conflict`,
      );
    }

    return mapExecutionFee(existing);
  }
}
