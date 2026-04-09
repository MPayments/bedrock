import type { PartyAddress } from "../contracts";
import type {
  PartyProfilesReads,
  PartyProfileOwnerRef,
} from "../ports/party-profiles.reads";

export class FindPartyProfileAddressByOwnerQuery {
  constructor(private readonly reads: PartyProfilesReads) {}

  async execute(
    input: PartyProfileOwnerRef,
  ): Promise<PartyAddress | null> {
    return this.reads.findAddressByOwner(input);
  }
}
