import type { PartyAddress, PartyAddressInput } from "../contracts";
import type { LegalEntitiesCommandUnitOfWork } from "../ports/legal-entities.uow";
import type { LegalEntityOwnerRef } from "../ports/legal-entities.store";
import { validateAddressInputs } from "../validation";

export class ReplaceLegalEntityAddressesCommand {
  constructor(private readonly commandUow: LegalEntitiesCommandUnitOfWork) {}

  async execute(
    input: LegalEntityOwnerRef & { items: PartyAddressInput[] },
  ): Promise<PartyAddress[]> {
    validateAddressInputs(input.items);
    return this.commandUow.run((tx) => tx.legalEntities.replaceAddresses(input));
  }
}
