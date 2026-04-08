import type { PartyAddress, PartyAddressInput } from "../contracts";
import type { PartyProfilesCommandUnitOfWork } from "../ports/party-profiles.uow";
import type { PartyProfileOwnerRef } from "../ports/party-profiles.store";

export class ReplacePartyProfileAddressCommand {
  constructor(private readonly commandUow: PartyProfilesCommandUnitOfWork) {}

  async execute(
    input: PartyProfileOwnerRef & { item: PartyAddressInput | null },
  ): Promise<PartyAddress | null> {
    return this.commandUow.run((tx) => tx.partyProfiles.replaceAddress(input));
  }
}
