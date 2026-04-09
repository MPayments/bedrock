import type { PartyLicense, PartyLicenseInput } from "../contracts";
import type { PartyProfileOwnerRef } from "../ports/party-profiles.store";
import type { PartyProfilesCommandUnitOfWork } from "../ports/party-profiles.uow";

export class ReplacePartyProfileLicensesCommand {
  constructor(private readonly commandUow: PartyProfilesCommandUnitOfWork) {}

  async execute(
    input: PartyProfileOwnerRef & { items: PartyLicenseInput[] },
  ): Promise<PartyLicense[]> {
    return this.commandUow.run((tx) => tx.partyProfiles.replaceLicenses(input));
  }
}
