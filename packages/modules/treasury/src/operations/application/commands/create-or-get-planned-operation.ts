import {
  CreatePlannedTreasuryOperationInputSchema,
  type CreatePlannedTreasuryOperationInput,
} from "../contracts/commands";
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

export class CreateOrGetPlannedTreasuryOperationCommand {
  constructor(private readonly operationsRepository: TreasuryOperationsRepository) {}

  async execute(
    raw: CreatePlannedTreasuryOperationInput,
  ): Promise<TreasuryOperation> {
    const validated = CreatePlannedTreasuryOperationInputSchema.parse(raw);

    const inserted = await this.operationsRepository.insertOperation({
      amountMinor: validated.amountMinor,
      counterAmountMinor: validated.counterAmountMinor,
      counterCurrencyId: validated.counterCurrencyId,
      currencyId: validated.currencyId,
      customerId: validated.customerId,
      dealId: validated.dealId,
      id: validated.id,
      internalEntityOrganizationId: validated.internalEntityOrganizationId,
      kind: validated.kind,
      quoteId: validated.quoteId,
      routeLegId: validated.routeLegId,
      sourceRef: validated.sourceRef,
      state: "planned",
    });

    if (inserted) {
      return mapOperation(inserted);
    }

    const existing = await this.operationsRepository.findOperationBySourceRef(
      validated.sourceRef,
    );

    if (!existing) {
      throw new Error(
        `Treasury operation ${validated.sourceRef} was not found after conflict`,
      );
    }

    return mapOperation(existing);
  }
}
