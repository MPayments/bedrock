import type { PartyProfileBundle, PartyProfileBundleInput } from "../contracts";
import type { PartyProfileOwnerRef } from "../ports/party-profiles.store";
import type { PartyProfilesCommandUnitOfWork } from "../ports/party-profiles.uow";
import { validatePartyProfileBundleInput } from "../validation";

export class ReplacePartyProfileBundleCommand {
  constructor(private readonly commandUow: PartyProfilesCommandUnitOfWork) {}

  async execute(
    input: PartyProfileOwnerRef & {
      bundle: PartyProfileBundleInput;
      partyKind?: "individual" | "legal_entity";
    },
  ): Promise<PartyProfileBundle> {
    validatePartyProfileBundleInput(input.bundle, input.partyKind);

    return this.commandUow.run(async (tx) => {
      await tx.partyProfiles.upsertProfile({
        ownerType: input.ownerType,
        ownerId: input.ownerId,
        profile: input.bundle.profile,
      });
      await tx.partyProfiles.replaceIdentifiers({
        ownerType: input.ownerType,
        ownerId: input.ownerId,
        items: input.bundle.identifiers,
      });
      await tx.partyProfiles.replaceAddress({
        ownerType: input.ownerType,
        ownerId: input.ownerId,
        item: input.bundle.address,
      });
      await tx.partyProfiles.replaceContacts({
        ownerType: input.ownerType,
        ownerId: input.ownerId,
        items: input.bundle.contacts,
      });
      await tx.partyProfiles.replaceRepresentatives({
        ownerType: input.ownerType,
        ownerId: input.ownerId,
        items: input.bundle.representatives,
      });
      await tx.partyProfiles.replaceLicenses({
        ownerType: input.ownerType,
        ownerId: input.ownerId,
        items: input.bundle.licenses,
      });

      const bundle = await tx.partyProfiles.findBundleByOwner({
        ownerType: input.ownerType,
        ownerId: input.ownerId,
      });

      if (!bundle) {
        throw new Error(
          `Party profile bundle not found after replace: ${input.ownerType}:${input.ownerId}`,
        );
      }

      return bundle;
    });
  }
}
