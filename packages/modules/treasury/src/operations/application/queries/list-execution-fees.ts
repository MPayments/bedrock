import type { PaginatedList } from "@bedrock/shared/core/pagination";

import type { TreasuryExecutionFee } from "../contracts/dto";
import type {
  TreasuryExecutionFeeRecord,
  TreasuryExecutionFeesRepository,
  TreasuryExecutionFeeListQuery,
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

export class ListTreasuryExecutionFeesQuery {
  constructor(
    private readonly feesRepository: TreasuryExecutionFeesRepository,
  ) {}

  async execute(
    input: TreasuryExecutionFeeListQuery,
  ): Promise<PaginatedList<TreasuryExecutionFee>> {
    const result = await this.feesRepository.listFees(input);

    return {
      data: result.rows.map(mapExecutionFee),
      limit: input.limit,
      offset: input.offset,
      total: result.total,
    };
  }
}
