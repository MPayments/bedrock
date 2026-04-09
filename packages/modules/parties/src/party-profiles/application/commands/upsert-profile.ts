import type {
  PartyProfile,
  PartyProfileInput,
} from "../contracts";
import type { PartyProfileOwnerRef } from "../ports/party-profiles.store";
import type { PartyProfilesCommandUnitOfWork } from "../ports/party-profiles.uow";

export class UpsertPartyProfileCommand {
  constructor(private readonly commandUow: PartyProfilesCommandUnitOfWork) {}

  async execute(
    input: PartyProfileOwnerRef & { profile: PartyProfileInput },
  ): Promise<PartyProfile> {
    return this.commandUow.run((tx) => tx.partyProfiles.upsertProfile(input));
  }
}
