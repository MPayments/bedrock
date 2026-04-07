import type { PartyLicense } from "../contracts";
import type {
  LegalEntitiesReads,
  LegalEntityOwnerRef,
} from "../ports/legal-entities.reads";

export class ListLegalEntityLicensesByOwnerQuery {
  constructor(private readonly reads: LegalEntitiesReads) {}

  async execute(
    input: LegalEntityOwnerRef,
  ): Promise<PartyLicense[]> {
    return this.reads.listLicensesByOwner(input);
  }
}
