import type { ModuleRuntime } from "@bedrock/shared/core";

import { OrganizationNotFoundError } from "../../../errors";
import type { OrganizationsCommandUnitOfWork } from "../ports/organizations.uow";

export class SoftDeleteOrganizationCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly unitOfWork: OrganizationsCommandUnitOfWork,
  ) {}

  async execute(id: number) {
    return this.unitOfWork.run(async (tx) => {
      const deleted = await tx.organizationStore.softDelete(id);
      if (!deleted) {
        throw new OrganizationNotFoundError(id);
      }

      this.runtime.log.info("Organization soft-deleted", { id });

      return deleted;
    });
  }
}
