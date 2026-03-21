import type { ModuleRuntime } from "@bedrock/shared/core";
import { applyPatch } from "@bedrock/shared/core/patch";

import {
  UpdateOrganizationInputSchema,
  type UpdateOrganizationInput,
} from "../contracts/commands";
import { OrganizationNotFoundError } from "../errors";
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
          externalId: existing.externalId,
          shortName: existing.shortName,
          fullName: existing.fullName,
          description: existing.description,
          country: existing.country,
          kind: existing.kind,
        },
        validated,
      );

      const updated = await tx.organizationStore.update({
        id,
        ...next,
      });

      if (!updated) {
        throw new OrganizationNotFoundError(id);
      }

      this.runtime.log.info("Organization updated", { id });
      return updated;
    });
  }
}
