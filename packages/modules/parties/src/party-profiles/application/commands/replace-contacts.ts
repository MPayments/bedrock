import type { PartyContact, PartyContactInput } from "../contracts";
import type { PartyProfileOwnerRef } from "../ports/party-profiles.store";
import type { PartyProfilesCommandUnitOfWork } from "../ports/party-profiles.uow";
import { validateContactInputs } from "../validation";

export class ReplacePartyProfileContactsCommand {
  constructor(private readonly commandUow: PartyProfilesCommandUnitOfWork) {}

  async execute(
    input: PartyProfileOwnerRef & { items: PartyContactInput[] },
  ): Promise<PartyContact[]> {
    validateContactInputs(input.items);
    return this.commandUow.run((tx) => tx.partyProfiles.replaceContacts(input));
  }
}
