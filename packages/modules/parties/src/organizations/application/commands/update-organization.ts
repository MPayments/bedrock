import type { ModuleRuntime } from "@bedrock/shared/core";
import { applyPatch } from "@bedrock/shared/core/patch";

import {
  UpdateOrganizationInputSchema,
  type UpdateOrganizationInput,
} from "../contracts/commands";
import { OrganizationNotFoundError } from "../errors";
import { toOrganizationDto } from "../to-organization-dto";
import type { OrganizationsCommandUnitOfWork } from "../ports/organizations.uow";

export class UpdateOrganizationCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly uow: OrganizationsCommandUnitOfWork,
  ) {}

  async execute(id: string, input: UpdateOrganizationInput) {
    const validated = UpdateOrganizationInputSchema.parse(input);

    return this.uow.run(async (tx) => {
      const existing = await tx.organizationStore.findById(id);
      if (!existing) {
        throw new OrganizationNotFoundError(id);
      }

      const next = applyPatch(
        {
          shortName: existing.shortName,
          fullName: existing.fullName,
          country: existing.country,
          externalId: existing.externalId,
          description: existing.description,
          isActive: existing.isActive,
          signatureKey: existing.signatureKey,
          sealKey: existing.sealKey,
        },
        validated,
      );

      const updated = await tx.organizationStore.update({
        id,
        externalId: next.externalId,
        shortName: next.shortName,
        fullName: next.fullName,
        description: next.description,
        country: next.country,
        kind: existing.kind,
        isActive: next.isActive,
        signatureKey: next.signatureKey,
        sealKey: next.sealKey,
      });

      if (!updated) {
        throw new OrganizationNotFoundError(id);
      }

      const partyProfile = await tx.partyProfiles.findBundleByOwner({
        ownerType: "organization",
        ownerId: updated.id,
      });

      this.runtime.log.info("Organization updated", { id });
      return toOrganizationDto(updated, partyProfile);
    });
  }
}
