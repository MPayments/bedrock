import type { Requisite } from "../contracts/requisites";
import type { RequisiteReads } from "../ports/requisite.reads";

export class FindPreferredCounterpartyBankByCounterpartyIdQuery {
  constructor(private readonly reads: RequisiteReads) {}

  async execute(counterpartyId: string): Promise<Requisite | null> {
    const requisites =
      await this.reads.listActiveBankByCounterpartyId(counterpartyId);
    const preferred =
      requisites.find((requisite) => requisite.isDefault) ?? requisites[0] ?? null;

    return preferred ? this.reads.findById(preferred.id) : null;
  }
}
