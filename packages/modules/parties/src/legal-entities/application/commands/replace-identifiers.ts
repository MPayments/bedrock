import type {
  PartyLegalIdentifier,
  PartyLegalIdentifierInput,
} from "../contracts";
import type { LegalEntitiesCommandUnitOfWork } from "../ports/legal-entities.uow";
import type { LegalEntityOwnerRef } from "../ports/legal-entities.store";
import { validateIdentifierInputs } from "../validation";

export class ReplaceLegalEntityIdentifiersCommand {
  constructor(private readonly commandUow: LegalEntitiesCommandUnitOfWork) {}

  async execute(
    input: LegalEntityOwnerRef & { items: PartyLegalIdentifierInput[] },
  ): Promise<PartyLegalIdentifier[]> {
    validateIdentifierInputs(input.items);
    return this.commandUow.run((tx) => tx.legalEntities.replaceIdentifiers(input));
  }
}
