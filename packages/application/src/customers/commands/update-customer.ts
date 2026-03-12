import { eq, sql } from "drizzle-orm";

import { schema as counterpartiesSchema } from "@bedrock/application/counterparties/schema";
import { schema as customersSchema } from "@bedrock/application/customers/schema";

import { CustomerNotFoundError } from "../errors";
import type { CustomersServiceContext } from "../internal/context";
import { ensureCustomerGroupForCustomer } from "../internal/group-rules";
import {
    UpdateCustomerInputSchema,
    type Customer,
    type UpdateCustomerInput,
} from "../validation";

const schema = {
    ...customersSchema,
    ...counterpartiesSchema,
};

export function createUpdateCustomerHandler(
    context: CustomersServiceContext,
) {
    const { db, log } = context;

    return async function updateCustomer(
        id: string,
        input: UpdateCustomerInput,
    ): Promise<Customer> {
        const validated = UpdateCustomerInputSchema.parse(input);

        return db.transaction(async (tx) => {
            const [existing] = await tx
                .select()
                .from(schema.customers)
                .where(eq(schema.customers.id, id))
                .limit(1);

            if (!existing) {
                throw new CustomerNotFoundError(id);
            }

            const fields: Record<string, unknown> = {};
            if (validated.externalRef !== undefined) fields.externalRef = validated.externalRef;
            if (validated.displayName !== undefined) fields.displayName = validated.displayName;
            if (validated.description !== undefined) fields.description = validated.description;

            let row = existing;

            if (Object.keys(fields).length > 0) {
                fields.updatedAt = sql`now()`;

                const [updated] = await tx
                    .update(schema.customers)
                    .set(fields)
                    .where(eq(schema.customers.id, id))
                    .returning();

                if (!updated) {
                    throw new CustomerNotFoundError(id);
                }

                row = updated;
            }

            const displayNameChanged = validated.displayName !== undefined
                && validated.displayName !== existing.displayName;

            if (displayNameChanged) {
                await ensureCustomerGroupForCustomer(tx, id);

                await tx
                    .update(schema.counterpartyGroups)
                    .set({
                        name: row.displayName,
                        updatedAt: sql`now()`,
                    })
                    .where(eq(schema.counterpartyGroups.code, `customer:${id}`));
            }

            log.info("Customer updated", { id });

            return row;
        });
    };
}
