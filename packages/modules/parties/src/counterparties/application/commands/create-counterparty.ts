import type { ModuleRuntime } from "@bedrock/shared/core";

import { ensureManagedCustomerGroup } from "../../../shared/application/managed-customer-group";
import { GroupHierarchy } from "../../../shared/domain/group-hierarchy";
import { Counterparty } from "../../domain/counterparty";
import {
  CreateCounterpartyInputSchema,
  type CreateCounterpartyInput,
} from "../contracts/counterparty.commands";
import {
  CounterpartyCustomerNotFoundError,
  rethrowCounterpartyMembershipDomainError,
} from "../errors";
import type { CounterpartiesCommandUnitOfWork } from "../ports/counterparties.uow";

export class CreateCounterpartyCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly uow: CounterpartiesCommandUnitOfWork,
  ) {}

  async execute(input: CreateCounterpartyInput) {
    const validated = CreateCounterpartyInputSchema.parse(input);

    return this.uow.run(async (tx) => {
      const now = this.runtime.now();
      let managedGroupId: string | null = null;

      if (validated.customerId) {
        const customer = await tx.customerStore.findById(validated.customerId);
        if (!customer) {
          throw new CounterpartyCustomerNotFoundError(validated.customerId);
        }

        const managedGroup = await ensureManagedCustomerGroup({
          generateUuid: this.runtime.generateUuid,
          groups: tx.counterpartyGroups,
          customerId: validated.customerId,
          displayName: customer.displayName,
          now,
        });
        managedGroupId = managedGroup.toSnapshot().id;
      }

      const hierarchy = GroupHierarchy.create(
        await tx.counterpartyGroupHierarchy.listHierarchyNodes(),
      );

      let draft: Counterparty;
      try {
        draft = Counterparty.create(
          {
            id: this.runtime.generateUuid(),
            ...validated,
          },
          {
            hierarchy,
            managedGroupId,
            now,
          },
        );
      } catch (error) {
        rethrowCounterpartyMembershipDomainError(error);
      }

      const created = await tx.counterparties.save(draft);
      const createdSnapshot = created.toSnapshot();

      this.runtime.log.info("Counterparty created", {
        id: createdSnapshot.id,
        shortName: createdSnapshot.shortName,
      });

      return createdSnapshot;
    });
  }
}
