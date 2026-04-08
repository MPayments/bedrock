import type {
  PartyIdentifier,
  PartyIdentifierInput,
} from "../contracts";
import type { PartyProfileOwnerRef } from "../ports/party-profiles.store";
import type { PartyProfilesCommandUnitOfWork } from "../ports/party-profiles.uow";
import { validateIdentifierInputs } from "../validation";

export class ReplacePartyProfileIdentifiersCommand {
  constructor(private readonly commandUow: PartyProfilesCommandUnitOfWork) {}

  async execute(
    input: PartyProfileOwnerRef & { items: PartyIdentifierInput[] },
  ): Promise<PartyIdentifier[]> {
    validateIdentifierInputs(input.items);
    return this.commandUow.run((tx) => tx.partyProfiles.replaceIdentifiers(input));
  }
}
