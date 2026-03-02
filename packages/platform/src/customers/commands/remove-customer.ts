import { eq } from "drizzle-orm";

import {
  schema as customersSchema,
} from "@bedrock/platform/customers/schema";
import { schema as documentsSchema } from "@bedrock/platform/documents/schema";

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

      const [orderReference] = await tx
        .select({ id: documentsSchema.documents.id })
        .from(documentsSchema.documents)
        .where(eq(documentsSchema.documents.customerId, id))
        .limit(1);

      if (orderReference) {
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
