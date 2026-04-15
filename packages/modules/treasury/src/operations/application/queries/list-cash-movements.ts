import type { PaginatedList } from "@bedrock/shared/core/pagination";

import type { TreasuryCashMovement } from "../contracts/dto";
import type {
  TreasuryCashMovementListQuery,
  TreasuryCashMovementRecord,
  TreasuryCashMovementsRepository,
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

export class ListTreasuryCashMovementsQuery {
  constructor(
    private readonly cashMovementsRepository: TreasuryCashMovementsRepository,
  ) {}

  async execute(
    input: TreasuryCashMovementListQuery,
  ): Promise<PaginatedList<TreasuryCashMovement>> {
    const result = await this.cashMovementsRepository.listCashMovements(input);

    return {
      data: result.rows.map(mapCashMovement),
      limit: input.limit,
      offset: input.offset,
      total: result.total,
    };
  }
}
