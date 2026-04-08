import type { PartyLicense } from "../contracts";
import type {
  PartyProfilesReads,
  PartyProfileOwnerRef,
} from "../ports/party-profiles.reads";

export class ListPartyProfileLicensesByOwnerQuery {
  constructor(private readonly reads: PartyProfilesReads) {}

  async execute(
    input: PartyProfileOwnerRef,
  ): Promise<PartyLicense[]> {
    return this.reads.listLicensesByOwner(input);
  }
}
