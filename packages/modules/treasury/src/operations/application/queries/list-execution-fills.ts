import type { PaginatedList } from "@bedrock/shared/core/pagination";

import type { TreasuryExecutionFill } from "../contracts/dto";
import type {
  TreasuryExecutionFillRecord,
  TreasuryExecutionFillsRepository,
  TreasuryExecutionFillListQuery,
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

export class ListTreasuryExecutionFillsQuery {
  constructor(
    private readonly fillsRepository: TreasuryExecutionFillsRepository,
  ) {}

  async execute(
    input: TreasuryExecutionFillListQuery,
  ): Promise<PaginatedList<TreasuryExecutionFill>> {
    const result = await this.fillsRepository.listFills(input);

    return {
      data: result.rows.map(mapExecutionFill),
      limit: input.limit,
      offset: input.offset,
      total: result.total,
    };
  }
}
