import type { PartyProfileBundle } from "../contracts";
import type {
  PartyProfilesReads,
  PartyProfileOwnerRef,
} from "../ports/party-profiles.reads";

export class FindPartyProfileBundleByOwnerQuery {
  constructor(private readonly reads: PartyProfilesReads) {}

  async execute(
    input: PartyProfileOwnerRef,
  ): Promise<PartyProfileBundle | null> {
    return this.reads.findBundleByOwner(input);
  }
}
