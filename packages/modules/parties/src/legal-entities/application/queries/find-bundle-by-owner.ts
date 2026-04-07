import type { PartyLegalEntityBundle } from "../contracts";
import type {
  LegalEntitiesReads,
  LegalEntityOwnerRef,
} from "../ports/legal-entities.reads";

export class FindLegalEntityBundleByOwnerQuery {
  constructor(private readonly reads: LegalEntitiesReads) {}

  async execute(
    input: LegalEntityOwnerRef,
  ): Promise<PartyLegalEntityBundle | null> {
    return this.reads.findBundleByOwner(input);
  }
}
