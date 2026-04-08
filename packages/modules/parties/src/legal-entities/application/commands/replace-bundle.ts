import type { PartyLegalEntityBundle, PartyLegalEntityBundleInput } from "../contracts";
import type { LegalEntitiesCommandUnitOfWork } from "../ports/legal-entities.uow";
import type { LegalEntityOwnerRef } from "../ports/legal-entities.store";
import { validateLegalEntityBundleInput } from "../validation";

export class ReplaceLegalEntityBundleCommand {
  constructor(private readonly commandUow: LegalEntitiesCommandUnitOfWork) {}

  async execute(
    input: LegalEntityOwnerRef & { bundle: PartyLegalEntityBundleInput },
  ): Promise<PartyLegalEntityBundle> {
    validateLegalEntityBundleInput(input.bundle);

    return this.commandUow.run(async (tx) => {
      await tx.legalEntities.upsertProfile({
        ownerType: input.ownerType,
        ownerId: input.ownerId,
        profile: input.bundle.profile,
      });
      await tx.legalEntities.replaceIdentifiers({
        ownerType: input.ownerType,
        ownerId: input.ownerId,
        items: input.bundle.identifiers,
      });
      await tx.legalEntities.replaceAddress({
        ownerType: input.ownerType,
        ownerId: input.ownerId,
        item: input.bundle.address,
      });
      await tx.legalEntities.replaceContacts({
        ownerType: input.ownerType,
        ownerId: input.ownerId,
        items: input.bundle.contacts,
      });
      await tx.legalEntities.replaceRepresentatives({
        ownerType: input.ownerType,
        ownerId: input.ownerId,
        items: input.bundle.representatives,
      });
      await tx.legalEntities.replaceLicenses({
        ownerType: input.ownerType,
        ownerId: input.ownerId,
        items: input.bundle.licenses,
      });

      const bundle = await tx.legalEntities.findBundleByOwner({
        ownerType: input.ownerType,
        ownerId: input.ownerId,
      });

      if (!bundle) {
        throw new Error(
          `Legal entity bundle not found after replace: ${input.ownerType}:${input.ownerId}`,
        );
      }

      return bundle;
    });
  }
}
