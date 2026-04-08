import type { PartyAddress } from "../contracts";
import type {
  LegalEntitiesReads,
  LegalEntityOwnerRef,
} from "../ports/legal-entities.reads";

export class FindLegalEntityAddressByOwnerQuery {
  constructor(private readonly reads: LegalEntitiesReads) {}

  async execute(
    input: LegalEntityOwnerRef,
  ): Promise<PartyAddress | null> {
    return this.reads.findAddressByOwner(input);
  }
}
