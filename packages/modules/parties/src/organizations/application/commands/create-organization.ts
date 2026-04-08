import type { ModuleRuntime } from "@bedrock/shared/core";

import { validatePartyProfileBundleInput } from "../../../party-profiles/application/validation";
import {
  CreateOrganizationInputSchema,
  type CreateOrganizationInput,
} from "../contracts/commands";
import type { OrganizationsCommandUnitOfWork } from "../ports/organizations.uow";
import { toOrganizationDto } from "../to-organization-dto";

export class CreateOrganizationCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly uow: OrganizationsCommandUnitOfWork,
  ) {}

  async execute(input: CreateOrganizationInput) {
    const validated = CreateOrganizationInputSchema.parse(input);

    return this.uow.run(async (tx) => {
      const id = this.runtime.generateUuid();
      const partyProfileInput = validated.partyProfile;
      if (partyProfileInput) {
        validatePartyProfileBundleInput(partyProfileInput, validated.kind);
      }
      const shortName =
        partyProfileInput?.profile.shortName ?? validated.shortName!;
      const fullName =
        partyProfileInput?.profile.fullName ?? validated.fullName!;
      const country =
        partyProfileInput?.profile.countryCode ?? validated.country;
      const created = await tx.organizationStore.create({
        id,
        externalRef: validated.externalRef,
        shortName,
        fullName,
        description: validated.description,
        country,
        kind: validated.kind,
        isActive: validated.isActive,
        signatureKey: validated.signatureKey,
        sealKey: validated.sealKey,
      });
      let partyProfile = null;

      if (partyProfileInput) {
        const profile = await tx.partyProfiles.upsertProfile({
          ownerType: "organization",
          ownerId: id,
          profile: partyProfileInput.profile,
        });
        const identifiers = await tx.partyProfiles.replaceIdentifiers({
          ownerType: "organization",
          ownerId: id,
          items: partyProfileInput.identifiers,
        });
        const address = await tx.partyProfiles.replaceAddress({
          ownerType: "organization",
          ownerId: id,
          item: partyProfileInput.address,
        });
        const contacts = await tx.partyProfiles.replaceContacts({
          ownerType: "organization",
          ownerId: id,
          items: partyProfileInput.contacts,
        });
        const representatives = await tx.partyProfiles.replaceRepresentatives({
          ownerType: "organization",
          ownerId: id,
          items: partyProfileInput.representatives,
        });
        const licenses = await tx.partyProfiles.replaceLicenses({
          ownerType: "organization",
          ownerId: id,
          items: partyProfileInput.licenses,
        });

        partyProfile = {
          profile,
          identifiers,
          address,
          contacts,
          representatives,
          licenses,
        };
      }

      this.runtime.log.info("Organization created", {
        id: created.id,
        shortName: created.shortName,
      });

      return toOrganizationDto(created, partyProfile);
    });
  }
}
