import type { ModuleRuntime } from "@bedrock/shared/core";

import { CounterpartyGroup } from "../../domain/counterparty-group";
import {
  CreateCounterpartyGroupInputSchema,
  type CreateCounterpartyGroupInput,
} from "../contracts/counterparty-group.commands";
import {
  CounterpartyCustomerNotFoundError,
  rethrowCounterpartyGroupDomainError,
} from "../errors";
import type { CounterpartiesCommandUnitOfWork } from "../ports/counterparties.uow";

export class CreateCounterpartyGroupCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly uow: CounterpartiesCommandUnitOfWork,
  ) {}

  async execute(input: CreateCounterpartyGroupInput) {
    const validated = CreateCounterpartyGroupInputSchema.parse(input);

    return this.uow.run(async (tx) => {
      if (validated.customerId) {
        const customer = await tx.customerStore.findById(validated.customerId);
        if (!customer) {
          throw new CounterpartyCustomerNotFoundError(validated.customerId);
        }
      }

      const parent = validated.parentId
        ? await tx.counterpartyGroups.findById(validated.parentId)
        : null;

      let draft: CounterpartyGroup;
      try {
        draft = CounterpartyGroup.create(
          {
            id: this.runtime.generateUuid(),
            isSystem: false,
            ...validated,
          },
          {
            parent: parent?.toSnapshot() ?? null,
            now: this.runtime.now(),
          },
        );
      } catch (error) {
        rethrowCounterpartyGroupDomainError(error);
      }

      const created = await tx.counterpartyGroups.save(draft);

      this.runtime.log.info("Counterparty group created", {
        id: created.id,
        code: created.toSnapshot().code,
      });

      return created.toSnapshot();
    });
  }
}
