import type { PartyContact } from "../contracts";
import type {
  LegalEntitiesReads,
  LegalEntityOwnerRef,
} from "../ports/legal-entities.reads";

export class ListLegalEntityContactsByOwnerQuery {
  constructor(private readonly reads: LegalEntitiesReads) {}

  async execute(
    input: LegalEntityOwnerRef,
  ): Promise<PartyContact[]> {
    return this.reads.listContactsByOwner(input);
  }
}
