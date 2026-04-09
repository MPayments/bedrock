import type { ModuleRuntime } from "@bedrock/shared/core";

import { ensureManagedCustomerGroup } from "../../../shared/application/managed-customer-group";
import {
  CreateCustomerInputSchema,
  type CreateCustomerInput,
} from "../contracts/commands";
import type { CustomersCommandUnitOfWork } from "../ports/customers.uow";

export class CreateCustomerCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly unitOfWork: CustomersCommandUnitOfWork,
  ) {}

  async execute(input: CreateCustomerInput) {
    const validated = CreateCustomerInputSchema.parse(input);

    return this.unitOfWork.run(async (tx) => {
      const now = this.runtime.now();
      const created = await tx.customerStore.create({
        id: this.runtime.generateUuid(),
        ...validated,
      });

      await ensureManagedCustomerGroup({
        generateUuid: this.runtime.generateUuid,
        groups: tx.counterpartyGroups,
        customerId: created.id,
        name: created.name,
        now,
      });

      this.runtime.log.info("Customer created", {
        id: created.id,
        name: created.name,
      });

      return created;
    });
  }
}
