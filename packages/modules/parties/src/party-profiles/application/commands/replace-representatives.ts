import type {
  PartyRepresentative,
  PartyRepresentativeInput,
} from "../contracts";
import type { PartyProfileOwnerRef } from "../ports/party-profiles.store";
import type { PartyProfilesCommandUnitOfWork } from "../ports/party-profiles.uow";
import { validateRepresentativeInputs } from "../validation";

export class ReplacePartyProfileRepresentativesCommand {
  constructor(private readonly commandUow: PartyProfilesCommandUnitOfWork) {}

  async execute(
    input: PartyProfileOwnerRef & { items: PartyRepresentativeInput[] },
  ): Promise<PartyRepresentative[]> {
    validateRepresentativeInputs(input.items);
    return this.commandUow.run((tx) =>
      tx.partyProfiles.replaceRepresentatives(input),
    );
  }
}
