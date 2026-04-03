import type { ModuleRuntime } from "@bedrock/shared/core";

import { ensureManagedCustomerGroup } from "../../../shared/application/managed-customer-group";
import {
  type UpdateCustomerInput,
  UpdateCustomerInputSchema,
} from "../contracts/commands";
import { CustomerNotFoundError } from "../errors";
import type { CustomersCommandUnitOfWork } from "../ports/customers.uow";

export class UpdateCustomerCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly uow: CustomersCommandUnitOfWork,
  ) {}

  async execute(id: string, input: UpdateCustomerInput) {
    const validated = UpdateCustomerInputSchema.parse(input);

    return this.uow.run(async (tx) => {
      const existing = await tx.customerStore.findById(id);
      if (!existing) throw new CustomerNotFoundError(id);

      const next = {
        externalRef: existing.externalRef,
        displayName: existing.displayName,
        description: existing.description,
        ...validated,
      };

      const updated = await tx.customerStore.update({ id, ...next });
      if (!updated) throw new CustomerNotFoundError(id);

      if (existing.displayName !== updated.displayName) {
        await ensureManagedCustomerGroup({
          generateUuid: this.runtime.generateUuid,
          groups: tx.counterpartyGroups,
          customerId: id,
          displayName: updated.displayName,
          now: this.runtime.now(),
        });
      }

      this.runtime.log.info("Customer updated", { id });
      return updated;
    });
  }
}
