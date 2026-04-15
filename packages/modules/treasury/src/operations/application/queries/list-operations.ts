import type { PaginatedList } from "@bedrock/shared/core/pagination";

import type { TreasuryOperation } from "../contracts/dto";
import type {
  TreasuryOperationsListQuery,
  TreasuryOperationsRepository,
} from "../ports/operations.repository";

function mapOperation(input: {
  amountMinor: bigint | null;
  counterAmountMinor: bigint | null;
  counterCurrencyId: string | null;
  createdAt: Date;
  currencyId: string | null;
  customerId: string | null;
  dealId: string | null;
  id: string;
  internalEntityOrganizationId: string | null;
  kind: TreasuryOperation["kind"];
  quoteId: string | null;
  routeLegId: string | null;
  sourceRef: string;
  state: TreasuryOperation["state"];
  updatedAt: Date;
}): TreasuryOperation {
  return {
    amountMinor: input.amountMinor?.toString() ?? null,
    counterAmountMinor: input.counterAmountMinor?.toString() ?? null,
    counterCurrencyId: input.counterCurrencyId,
    createdAt: input.createdAt,
    currencyId: input.currencyId,
    customerId: input.customerId,
    dealId: input.dealId,
    id: input.id,
    internalEntityOrganizationId: input.internalEntityOrganizationId,
    kind: input.kind,
    quoteId: input.quoteId,
    routeLegId: input.routeLegId,
    sourceRef: input.sourceRef,
    state: input.state,
    updatedAt: input.updatedAt,
  };
}

export class ListTreasuryOperationsQuery {
  constructor(
    private readonly operationsRepository: TreasuryOperationsRepository,
  ) {}

  async execute(
    input: TreasuryOperationsListQuery,
  ): Promise<PaginatedList<TreasuryOperation>> {
    const result = await this.operationsRepository.listOperations(input);

    return {
      data: result.rows.map(mapOperation),
      limit: input.limit,
      offset: input.offset,
      total: result.total,
    };
  }
}
