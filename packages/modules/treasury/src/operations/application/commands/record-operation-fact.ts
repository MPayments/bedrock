import { ValidationError } from "../../../errors";
import { TreasuryOperationNotFoundError } from "../../../errors";
import {
  RecordTreasuryOperationFactInputSchema,
  type RecordTreasuryOperationFactInput,
} from "../contracts/commands";
import type { TreasuryOperationFact } from "../contracts/dto";
import type {
  TreasuryOperationFactRecord,
  TreasuryOperationFactsRepository,
  TreasuryOperationsRepository,
} from "../ports/operations.repository";

function mapOperationFact(input: TreasuryOperationFactRecord): TreasuryOperationFact {
  return {
    amountMinor: input.amountMinor?.toString() ?? null,
    confirmedAt: input.confirmedAt,
    counterAmountMinor: input.counterAmountMinor?.toString() ?? null,
    counterCurrencyId: input.counterCurrencyId,
    createdAt: input.createdAt,
    currencyId: input.currencyId,
    dealId: input.dealId,
    externalRecordId: input.externalRecordId,
    feeAmountMinor: input.feeAmountMinor?.toString() ?? null,
    feeCurrencyId: input.feeCurrencyId,
    id: input.id,
    instructionId: input.instructionId,
    metadata: input.metadata,
    notes: input.notes,
    operationId: input.operationId,
    providerRef: input.providerRef,
    recordedAt: input.recordedAt,
    routeLegId: input.routeLegId,
    sourceKind: input.sourceKind,
    sourceRef: input.sourceRef,
    updatedAt: input.updatedAt,
  };
}

export class RecordTreasuryOperationFactCommand {
  constructor(
    private readonly factsRepository: TreasuryOperationFactsRepository,
    private readonly operationsRepository: TreasuryOperationsRepository,
    private readonly generateUuid: () => string,
    private readonly now: () => Date,
  ) {}

  async execute(
    raw: RecordTreasuryOperationFactInput,
  ): Promise<TreasuryOperationFact> {
    const validated = RecordTreasuryOperationFactInputSchema.parse(raw);
    const operation = await this.operationsRepository.findOperationById(
      validated.operationId,
    );

    if (!operation) {
      throw new TreasuryOperationNotFoundError(validated.operationId);
    }

    const currencyId = validated.currencyId ?? operation.currencyId;
    const counterCurrencyId =
      validated.counterCurrencyId ?? operation.counterCurrencyId;
    const routeLegId = validated.routeLegId ?? operation.routeLegId;

    if (validated.amountMinor !== null && currencyId === null) {
      throw new ValidationError(
        `Treasury operation fact ${validated.sourceRef} requires currencyId when amountMinor is set`,
      );
    }

    if (
      validated.counterAmountMinor !== null &&
      counterCurrencyId === null
    ) {
      throw new ValidationError(
        `Treasury operation fact ${validated.sourceRef} requires counterCurrencyId when counterAmountMinor is set`,
      );
    }

    if (
      validated.feeAmountMinor !== null &&
      validated.feeCurrencyId === null
    ) {
      throw new ValidationError(
        `Treasury operation fact ${validated.sourceRef} requires feeCurrencyId when feeAmountMinor is set`,
      );
    }

    const inserted = await this.factsRepository.insertFact({
      amountMinor: validated.amountMinor,
      confirmedAt: validated.confirmedAt,
      counterAmountMinor: validated.counterAmountMinor,
      counterCurrencyId,
      currencyId,
      dealId: operation.dealId,
      externalRecordId: validated.externalRecordId,
      feeAmountMinor: validated.feeAmountMinor,
      feeCurrencyId: validated.feeCurrencyId,
      id: this.generateUuid(),
      instructionId: validated.instructionId,
      metadata: validated.metadata,
      notes: validated.notes,
      operationId: operation.id,
      providerRef: validated.providerRef,
      recordedAt: validated.recordedAt ?? this.now(),
      routeLegId,
      sourceKind: validated.sourceKind,
      sourceRef: validated.sourceRef,
    });

    if (inserted) {
      return mapOperationFact(inserted);
    }

    const existing = await this.factsRepository.findFactBySourceRef(
      validated.sourceRef,
    );

    if (!existing) {
      throw new Error(
        `Treasury operation fact ${validated.sourceRef} was not found after conflict`,
      );
    }

    return mapOperationFact(existing);
  }
}
