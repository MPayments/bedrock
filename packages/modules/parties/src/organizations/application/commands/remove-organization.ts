import type { ModuleRuntime } from "@bedrock/shared/core";

import {
  OrganizationDeleteConflictError,
  OrganizationNotFoundError,
} from "../errors";
import type { OrganizationsCommandUnitOfWork } from "../ports/organizations.uow";

export class RemoveOrganizationCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly uow: OrganizationsCommandUnitOfWork,
  ) {}

  async execute(id: string): Promise<void> {
    await this.uow.run(async (tx) => {
      const result = await tx.organizationStore.remove(id);
      if (result === "deleted") {
        return;
      }

      if (result === "not_found") {
        throw new OrganizationNotFoundError(id);
      }

      throw new OrganizationDeleteConflictError(id);
    });

    this.runtime.log.info("Organization deleted", { id });
  }
}
