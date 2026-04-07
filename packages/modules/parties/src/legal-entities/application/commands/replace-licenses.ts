import type { PartyLicense, PartyLicenseInput } from "../contracts";
import type { LegalEntitiesCommandUnitOfWork } from "../ports/legal-entities.uow";
import type { LegalEntityOwnerRef } from "../ports/legal-entities.store";

export class ReplaceLegalEntityLicensesCommand {
  constructor(private readonly commandUow: LegalEntitiesCommandUnitOfWork) {}

  async execute(
    input: LegalEntityOwnerRef & { items: PartyLicenseInput[] },
  ): Promise<PartyLicense[]> {
    return this.commandUow.run((tx) => tx.legalEntities.replaceLicenses(input));
  }
}
