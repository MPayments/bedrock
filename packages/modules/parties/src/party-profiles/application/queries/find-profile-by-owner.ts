import type { PartyProfile } from "../contracts";
import type {
  PartyProfilesReads,
  PartyProfileOwnerRef,
} from "../ports/party-profiles.reads";

export class FindPartyProfileByOwnerQuery {
  constructor(private readonly reads: PartyProfilesReads) {}

  async execute(
    input: PartyProfileOwnerRef,
  ): Promise<PartyProfile | null> {
    return this.reads.findProfileByOwner(input);
  }
}
