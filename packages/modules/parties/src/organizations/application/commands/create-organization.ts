import type { ModuleRuntime } from "@bedrock/shared/core";

import {
  CreateOrganizationInputSchema,
  type CreateOrganizationInput,
} from "../contracts/commands";
import { toOrganizationDto } from "../to-organization-dto";
import type { OrganizationsCommandUnitOfWork } from "../ports/organizations.uow";

export class CreateOrganizationCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly uow: OrganizationsCommandUnitOfWork,
  ) {}

  async execute(input: CreateOrganizationInput) {
    const validated = CreateOrganizationInputSchema.parse(input);

    return this.uow.run(async (tx) => {
      const id = this.runtime.generateUuid();
      const shortName =
        validated.kind === "legal_entity"
          ? validated.legalEntity!.profile.shortName
          : validated.shortName!;
      const fullName =
        validated.kind === "legal_entity"
          ? validated.legalEntity!.profile.fullName
          : validated.fullName!;
      const country =
        validated.kind === "legal_entity"
          ? validated.legalEntity!.profile.countryCode
          : validated.country;
      const created = await tx.organizationStore.create({
        id,
        externalId: validated.externalId,
        shortName,
        fullName,
        description: validated.description,
        country,
        kind: validated.kind,
        isActive: validated.isActive,
        signatureKey: validated.signatureKey,
        sealKey: validated.sealKey,
      });
      let legalEntity = null;

      if (validated.kind === "legal_entity" && validated.legalEntity) {
        const profile = await tx.legalEntities.upsertProfile({
          ownerType: "organization",
          ownerId: id,
          profile: validated.legalEntity.profile,
        });
        const identifiers = await tx.legalEntities.replaceIdentifiers({
          ownerType: "organization",
          ownerId: id,
          items: validated.legalEntity.identifiers,
        });
        const address = await tx.legalEntities.replaceAddress({
          ownerType: "organization",
          ownerId: id,
          item: validated.legalEntity.address,
        });
        const contacts = await tx.legalEntities.replaceContacts({
          ownerType: "organization",
          ownerId: id,
          items: validated.legalEntity.contacts,
        });
        const representatives = await tx.legalEntities.replaceRepresentatives({
          ownerType: "organization",
          ownerId: id,
          items: validated.legalEntity.representatives,
        });
        const licenses = await tx.legalEntities.replaceLicenses({
          ownerType: "organization",
          ownerId: id,
          items: validated.legalEntity.licenses,
        });

        legalEntity = {
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

      return toOrganizationDto(created, legalEntity);
    });
  }
}
