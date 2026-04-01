import type { Requisite } from "../contracts/requisites";
import type { RequisiteReads } from "../ports/requisite.reads";

export class FindPreferredCounterpartyBankByCounterpartyIdQuery {
  constructor(private readonly reads: RequisiteReads) {}

  async execute(counterpartyId: string): Promise<Requisite | null> {
    const requisites =
      await this.reads.listActiveBankByCounterpartyId(counterpartyId);

    return (
      requisites.find((requisite) => requisite.isDefault) ?? requisites[0] ?? null
    );
  }
}
