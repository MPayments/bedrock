import { schema } from "@bedrock/customers/schema";

import type { CustomersServiceContext } from "../internal/context";
import {
  CreateCustomerInputSchema,
  type Customer,
  type CreateCustomerInput,
} from "../validation";

export function createCreateCustomerHandler(context: CustomersServiceContext) {
  const { customerLifecycleSyncPort, db, log } = context;

  return async function createCustomer(
    input: CreateCustomerInput,
  ): Promise<Customer> {
    const validated = CreateCustomerInputSchema.parse(input);

    return db.transaction(async (tx) => {
      const [createdCustomer] = await tx
        .insert(schema.customers)
        .values({
          externalRef: validated.externalRef ?? null,
          displayName: validated.displayName,
          description: validated.description ?? null,
        })
        .returning();

      await customerLifecycleSyncPort.onCustomerCreated(tx, {
        customerId: createdCustomer!.id,
        displayName: createdCustomer!.displayName,
      });

      log.info("Customer created", {
        id: createdCustomer!.id,
        displayName: createdCustomer!.displayName,
      });

      return createdCustomer!;
    });
  };
}
