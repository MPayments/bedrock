import type { ModuleRuntime } from "@bedrock/shared/core";

import {
  CreateOrganizationInputSchema,
  type CreateOrganizationInput,
} from "../contracts/commands";
import type { OrganizationsCommandUnitOfWork } from "../ports/organizations.uow";

export class CreateOrganizationCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly uow: OrganizationsCommandUnitOfWork,
  ) {}

  async execute(input: CreateOrganizationInput) {
    const validated = CreateOrganizationInputSchema.parse(input);

    return this.uow.run(async (tx) => {
      const created = await tx.organizationStore.create({
        id: this.runtime.generateUuid(),
        ...validated,
      });

      this.runtime.log.info("Organization created", {
        id: created.id,
        shortName: created.shortName,
      });

      return created;
    });
  }
}
