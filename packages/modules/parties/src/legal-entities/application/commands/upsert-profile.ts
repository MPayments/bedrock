import type {
  PartyLegalProfile,
  PartyLegalProfileInput,
} from "../contracts";
import type { LegalEntitiesCommandUnitOfWork } from "../ports/legal-entities.uow";
import type { LegalEntityOwnerRef } from "../ports/legal-entities.store";

export class UpsertLegalEntityProfileCommand {
  constructor(private readonly commandUow: LegalEntitiesCommandUnitOfWork) {}

  async execute(
    input: LegalEntityOwnerRef & { profile: PartyLegalProfileInput },
  ): Promise<PartyLegalProfile> {
    return this.commandUow.run((tx) => tx.legalEntities.upsertProfile(input));
  }
}
