import type { PartyRepresentative } from "../contracts";
import type {
  LegalEntitiesReads,
  LegalEntityOwnerRef,
} from "../ports/legal-entities.reads";

export class ListLegalEntityRepresentativesByOwnerQuery {
  constructor(private readonly reads: LegalEntitiesReads) {}

  async execute(
    input: LegalEntityOwnerRef,
  ): Promise<PartyRepresentative[]> {
    return this.reads.listRepresentativesByOwner(input);
  }
}
