import type { ModuleRuntime } from "@bedrock/shared/core";

import {
  ClientHasApplicationsError,
  ClientNotFoundError,
} from "../../../errors";
import type { ClientsCommandUnitOfWork } from "../ports/clients.uow";

export class SoftDeleteClientCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly unitOfWork: ClientsCommandUnitOfWork,
  ) {}

  async execute(id: number) {
    return this.unitOfWork.run(async (tx) => {
      const existing = await tx.clientStore.findById(id);
      if (!existing) {
        throw new ClientNotFoundError(id);
      }

      // Cannot delete if client has applications
      const appCount = await tx.applicationReads.countByClientId(id);
      if (appCount > 0) {
        throw new ClientHasApplicationsError(id);
      }

      await tx.clientStore.softDelete(id);

      this.runtime.log.info("Client soft-deleted", { id });

      return true;
    });
  }
}
