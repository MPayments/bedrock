import type { ModuleRuntime } from "@bedrock/shared/core";

import { RequisiteNotFoundError } from "../errors";
import type { RequisitesCommandUnitOfWork } from "../ports/requisites.uow";

export class RemoveRequisiteCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly uow: RequisitesCommandUnitOfWork,
  ) {}

  async execute(id: string): Promise<void> {
    await this.uow.run(async (tx) => {
      const now = this.runtime.now();
      const existing = await tx.requisites.findById(id);
      if (!existing) {
        throw new RequisiteNotFoundError(id);
      }

      const current = existing.toSnapshot();
      const sourceSet = await tx.requisites.findSetByOwnerCurrency({
        ownerType: current.ownerType,
        ownerId: current.ownerId,
        currencyId: current.currencyId,
      });
      const archived = sourceSet.archiveRequisite(id, now);

      await tx.requisites.saveSet(archived.set);

      this.runtime.log.info("Requisite archived", {
        id,
        ownerType: current.ownerType,
        ownerId: current.ownerId,
      });
    });
  }
}
