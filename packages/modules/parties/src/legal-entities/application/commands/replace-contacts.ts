import type { PartyContact, PartyContactInput } from "../contracts";
import type { LegalEntitiesCommandUnitOfWork } from "../ports/legal-entities.uow";
import type { LegalEntityOwnerRef } from "../ports/legal-entities.store";
import { validateContactInputs } from "../validation";

export class ReplaceLegalEntityContactsCommand {
  constructor(private readonly commandUow: LegalEntitiesCommandUnitOfWork) {}

  async execute(
    input: LegalEntityOwnerRef & { items: PartyContactInput[] },
  ): Promise<PartyContact[]> {
    validateContactInputs(input.items);
    return this.commandUow.run((tx) => tx.legalEntities.replaceContacts(input));
  }
}
