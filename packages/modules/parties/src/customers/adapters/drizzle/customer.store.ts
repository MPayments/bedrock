import { eq, sql } from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";

import { customers } from "./schema";
import type {
  CustomerStore,
  CustomerWriteInput,
} from "../../application/ports/customer.store";

export class DrizzleCustomerStore implements CustomerStore {
  constructor(private readonly db: Queryable) {}

  async findById(id: string) {
    const [row] = await this.db
      .select()
      .from(customers)
      .where(eq(customers.id, id))
      .limit(1);

    return row ?? null;
  }

  async create(customer: CustomerWriteInput) {
    const [created] = await this.db
      .insert(customers)
      .values({
        id: customer.id,
        externalRef: customer.externalRef,
        displayName: customer.displayName,
        description: customer.description,
      })
      .returning();

    return created!;
  }

  async update(customer: CustomerWriteInput) {
    const [updated] = await this.db
      .update(customers)
      .set({
        externalRef: customer.externalRef,
        displayName: customer.displayName,
        description: customer.description,
        updatedAt: sql`now()`,
      })
      .where(eq(customers.id, customer.id))
      .returning();

    return updated ?? null;
  }

  async remove(id: string) {
    const [deleted] = await this.db
      .delete(customers)
      .where(eq(customers.id, id))
      .returning({ id: customers.id });

    return Boolean(deleted);
  }
}
