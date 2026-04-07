import type { PartyLegalIdentifier } from "../contracts";
import type {
  LegalEntitiesReads,
  LegalEntityOwnerRef,
} from "../ports/legal-entities.reads";

export class ListLegalEntityIdentifiersByOwnerQuery {
  constructor(private readonly reads: LegalEntitiesReads) {}

  async execute(
    input: LegalEntityOwnerRef,
  ): Promise<PartyLegalIdentifier[]> {
    return this.reads.listIdentifiersByOwner(input);
  }
}
