import { eq, sql } from "drizzle-orm";

import {
  schema as customersSchema,
} from "@bedrock/customers/schema";

import { CustomerDeleteConflictError, CustomerNotFoundError } from "../errors";
import type { CustomersServiceContext } from "../internal/context";
import {
  detachCounterpartiesFromCustomerTree,
  removeCustomerGroupForCustomer,
} from "../internal/group-rules";

const schema = {
  ...customersSchema,
};

export function createRemoveCustomerHandler(context: CustomersServiceContext) {
  const { db, log } = context;

  return async function removeCustomer(id: string): Promise<void> {
    await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: schema.customers.id })
        .from(schema.customers)
        .where(eq(schema.customers.id, id))
        .limit(1);

      if (!existing) {
        throw new CustomerNotFoundError(id);
      }

      const orderReference = await tx.execute(sql`
        select id
        from documents
        where customer_id = ${id}::uuid
        limit 1
      `);

      if ((orderReference.rows?.length ?? 0) > 0) {
        throw new CustomerDeleteConflictError(id);
      }

      await detachCounterpartiesFromCustomerTree(tx, id);
      await removeCustomerGroupForCustomer(tx, id);

      const [deleted] = await tx
        .delete(schema.customers)
        .where(eq(schema.customers.id, id))
        .returning({ id: schema.customers.id });

      if (!deleted) {
        throw new CustomerNotFoundError(id);
      }
    });

    log.info("Customer deleted", { id });
  };
}
