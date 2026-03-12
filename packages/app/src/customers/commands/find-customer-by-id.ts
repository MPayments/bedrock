import { eq } from "drizzle-orm";

import { schema } from "@bedrock/app/customers/schema";

import { CustomerNotFoundError } from "../errors";
import type { CustomersServiceContext } from "../internal/context";
import type { Customer } from "../validation";

export function createFindCustomerByIdHandler(
    context: CustomersServiceContext,
) {
    const { db } = context;

    return async function findCustomerById(id: string): Promise<Customer> {
        const [row] = await db
            .select()
            .from(schema.customers)
            .where(eq(schema.customers.id, id))
            .limit(1);

        if (!row) {
            throw new CustomerNotFoundError(id);
        }

        return row;
    };
}
