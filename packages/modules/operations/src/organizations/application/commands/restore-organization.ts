import type { ModuleRuntime } from "@bedrock/shared/core";

import { OrganizationNotFoundError } from "../../../errors";
import type { OrganizationsCommandUnitOfWork } from "../ports/organizations.uow";

export class RestoreOrganizationCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly unitOfWork: OrganizationsCommandUnitOfWork,
  ) {}

  async execute(id: number) {
    return this.unitOfWork.run(async (tx) => {
      const restored = await tx.organizationStore.restore(id);
      if (!restored) {
        throw new OrganizationNotFoundError(id);
      }

      this.runtime.log.info("Organization restored", { id });

      return restored;
    });
  }
}
