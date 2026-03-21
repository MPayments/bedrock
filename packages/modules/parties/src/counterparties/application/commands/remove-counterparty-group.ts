import type { ModuleRuntime } from "@bedrock/shared/core";

import { GroupHierarchy } from "../../../shared/domain/group-hierarchy";
import {
  CounterpartyGroupNotFoundError,
  rethrowCounterpartyGroupDomainError,
} from "../errors";
import type { CounterpartiesCommandUnitOfWork } from "../ports/counterparties.uow";

export class RemoveCounterpartyGroupCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly uow: CounterpartiesCommandUnitOfWork,
  ) {}

  async execute(id: string) {
    await this.uow.run(async (tx) => {
      const now = this.runtime.now();
      const existing = await tx.counterpartyGroups.findById(id);
      if (!existing) {
        throw new CounterpartyGroupNotFoundError(id);
      }

      try {
        existing.assertRemovable();
      } catch (error) {
        rethrowCounterpartyGroupDomainError(error);
      }

      const hierarchy = GroupHierarchy.create(
        await tx.counterpartyGroupHierarchy.listHierarchyNodes(),
      );
      const childGroups = await tx.counterpartyGroups.findByParentId(id);
      const nextParentId = existing.toSnapshot().parentId;

      for (const childGroup of childGroups) {
        let reparented;
        try {
          reparented = childGroup.reparent({
            hierarchy,
            now,
            parentId: nextParentId,
          });
        } catch (error) {
          rethrowCounterpartyGroupDomainError(error);
        }

        if (!childGroup.sameState(reparented)) {
          await tx.counterpartyGroups.save(reparented);
        }
      }

      const deleted = await tx.counterpartyGroups.remove(id);
      if (!deleted) {
        throw new CounterpartyGroupNotFoundError(id);
      }
    });

    this.runtime.log.info("Counterparty group deleted", { id });
  }
}
