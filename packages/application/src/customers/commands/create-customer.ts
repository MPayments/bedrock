import { schema } from "@bedrock/application/customers/schema";

import type { CustomersServiceContext } from "../internal/context";
import { ensureCustomerGroupForCustomer } from "../internal/group-rules";
import {
  CreateCustomerInputSchema,
  type Customer,
  type CreateCustomerInput,
} from "../validation";

export function createCreateCustomerHandler(context: CustomersServiceContext) {
  const { db, log } = context;

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

      await ensureCustomerGroupForCustomer(tx, createdCustomer!.id);

      log.info("Customer created", {
        id: createdCustomer!.id,
        displayName: createdCustomer!.displayName,
      });

      return createdCustomer!;
    });
  };
}
