import type { PartyRepresentative } from "../contracts";
import type {
  PartyProfilesReads,
  PartyProfileOwnerRef,
} from "../ports/party-profiles.reads";

export class ListPartyProfileRepresentativesByOwnerQuery {
  constructor(private readonly reads: PartyProfilesReads) {}

  async execute(
    input: PartyProfileOwnerRef,
  ): Promise<PartyRepresentative[]> {
    return this.reads.listRepresentativesByOwner(input);
  }
}
