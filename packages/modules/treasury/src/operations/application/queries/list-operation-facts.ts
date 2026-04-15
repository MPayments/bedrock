import type { PaginatedList } from "@bedrock/shared/core/pagination";

import type { TreasuryOperationFact } from "../contracts/dto";
import type {
  TreasuryOperationFactRecord,
  TreasuryOperationFactsListQuery,
  TreasuryOperationFactsRepository,
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

export class ListTreasuryOperationFactsQuery {
  constructor(
    private readonly factsRepository: TreasuryOperationFactsRepository,
  ) {}

  async execute(
    input: TreasuryOperationFactsListQuery,
  ): Promise<PaginatedList<TreasuryOperationFact>> {
    const result = await this.factsRepository.listFacts(input);

    return {
      data: result.rows.map(mapOperationFact),
      limit: input.limit,
      offset: input.offset,
      total: result.total,
    };
  }
}
