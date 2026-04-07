import type {
  PartyRepresentative,
  PartyRepresentativeInput,
} from "../contracts";
import type { LegalEntitiesCommandUnitOfWork } from "../ports/legal-entities.uow";
import type { LegalEntityOwnerRef } from "../ports/legal-entities.store";
import { validateRepresentativeInputs } from "../validation";

export class ReplaceLegalEntityRepresentativesCommand {
  constructor(private readonly commandUow: LegalEntitiesCommandUnitOfWork) {}

  async execute(
    input: LegalEntityOwnerRef & { items: PartyRepresentativeInput[] },
  ): Promise<PartyRepresentative[]> {
    validateRepresentativeInputs(input.items);
    return this.commandUow.run((tx) =>
      tx.legalEntities.replaceRepresentatives(input),
    );
  }
}
