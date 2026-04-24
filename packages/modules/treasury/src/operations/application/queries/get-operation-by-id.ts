import type { TreasuryOperation } from "../contracts/dto";
import type { TreasuryOperationsRepository } from "../ports/operations.repository";

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
    projectedState: null,
    quoteId: input.quoteId,
    sourceRef: input.sourceRef,
    state: input.state,
    updatedAt: input.updatedAt,
  };
}

export class GetTreasuryOperationByIdQuery {
  constructor(
    private readonly operationsRepository: TreasuryOperationsRepository,
  ) {}

  async execute(id: string): Promise<TreasuryOperation | null> {
    const operation = await this.operationsRepository.findOperationById(id);

    return operation ? mapOperation(operation) : null;
  }
}
