import type { Requisite } from "../contracts/requisites";
import type { RequisiteReads } from "../ports/requisite.reads";

export class FindOrganizationBankByIdQuery {
  constructor(private readonly reads: RequisiteReads) {}

  async execute(requisiteId: string): Promise<Requisite | null> {
    const requisite = await this.reads.findActiveById(requisiteId);

    if (
      !requisite ||
      requisite.ownerType !== "organization" ||
      requisite.kind !== "bank"
    ) {
      return null;
    }

    return requisite;
  }
}
