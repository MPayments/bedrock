import type { PartyAddress, PartyAddressInput } from "../contracts";
import type { LegalEntitiesCommandUnitOfWork } from "../ports/legal-entities.uow";
import type { LegalEntityOwnerRef } from "../ports/legal-entities.store";

export class ReplaceLegalEntityAddressCommand {
  constructor(private readonly commandUow: LegalEntitiesCommandUnitOfWork) {}

  async execute(
    input: LegalEntityOwnerRef & { item: PartyAddressInput | null },
  ): Promise<PartyAddress | null> {
    return this.commandUow.run((tx) => tx.legalEntities.replaceAddress(input));
  }
}
