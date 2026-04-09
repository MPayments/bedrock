import type { PartyIdentifier } from "../contracts";
import type {
  PartyProfilesReads,
  PartyProfileOwnerRef,
} from "../ports/party-profiles.reads";

export class ListPartyProfileIdentifiersByOwnerQuery {
  constructor(private readonly reads: PartyProfilesReads) {}

  async execute(
    input: PartyProfileOwnerRef,
  ): Promise<PartyIdentifier[]> {
    return this.reads.listIdentifiersByOwner(input);
  }
}
