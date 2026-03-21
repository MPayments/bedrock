import type { ModuleRuntime } from "@bedrock/shared/core";
import { applyPatch } from "@bedrock/shared/core/patch";

import { GroupHierarchy } from "../../../shared/domain/group-hierarchy";
import type { UpdateCounterpartyGroupProps } from "../../domain/counterparty-group";
import {
  type UpdateCounterpartyGroupInput,
  UpdateCounterpartyGroupInputSchema,
} from "../contracts/counterparty-group.commands";
import {
  CounterpartyCustomerNotFoundError,
  CounterpartyGroupNotFoundError,
  rethrowCounterpartyGroupDomainError,
} from "../errors";
import type { CounterpartiesCommandUnitOfWork } from "../ports/counterparties.uow";

export class UpdateCounterpartyGroupCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly uow: CounterpartiesCommandUnitOfWork,
  ) {}

  async execute(id: string, input: UpdateCounterpartyGroupInput) {
    const validated = UpdateCounterpartyGroupInputSchema.parse(input);

    return this.uow.run(async (tx) => {
      const existing = await tx.counterpartyGroups.findById(id);
      if (!existing) {
        throw new CounterpartyGroupNotFoundError(id);
      }

      const snapshot = existing.toSnapshot();
      const nextInput: UpdateCounterpartyGroupProps = applyPatch(
        {
          code: snapshot.code,
          name: snapshot.name,
          description: snapshot.description,
          parentId: snapshot.parentId,
          customerId: snapshot.customerId,
        },
        validated,
      );
      const hierarchy = GroupHierarchy.create(
        await tx.counterpartyGroupHierarchy.listHierarchyNodes(),
      );

      let next;
      try {
        next = existing.update(nextInput, {
          hierarchy,
          now: this.runtime.now(),
        });
      } catch (error) {
        rethrowCounterpartyGroupDomainError(error);
      }

      const nextCustomerId = next.toSnapshot().customerId;
      if (nextCustomerId) {
        const customer = await tx.customerStore.findById(nextCustomerId);
        if (!customer) {
          throw new CounterpartyCustomerNotFoundError(nextCustomerId);
        }
      }

      const updated = await tx.counterpartyGroups.save(next);

      this.runtime.log.info("Counterparty group updated", { id });
      return updated.toSnapshot();
    });
  }
}
