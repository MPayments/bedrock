import type { PartyLegalProfile } from "../contracts";
import type {
  LegalEntitiesReads,
  LegalEntityOwnerRef,
} from "../ports/legal-entities.reads";

export class FindLegalEntityProfileByOwnerQuery {
  constructor(private readonly reads: LegalEntitiesReads) {}

  async execute(
    input: LegalEntityOwnerRef,
  ): Promise<PartyLegalProfile | null> {
    return this.reads.findProfileByOwner(input);
  }
}
