import { eq } from "drizzle-orm";
import type { Database } from "@repo/db";
import { customers } from "@repo/db/schema";
import type { Customer, CreateCustomerInput, UpdateCustomerInput, ListCustomersQuery } from "./contract.js";

export type CustomersRepo = ReturnType<typeof createCustomersRepo>;

/**
 * Creates a Drizzle-based repository for customers.
 */
export function createCustomersRepo(db: Database) {
  return {
    async getById(id: string): Promise<Customer | null> {
      const rows = await db
        .select()
        .from(customers)
        .where(eq(customers.id, id))
        .limit(1);

      return rows[0] ?? null;
    },

    async list(query?: ListCustomersQuery): Promise<Customer[]> {
      if (query?.organizationId) {
        return db
          .select()
          .from(customers)
          .where(eq(customers.organizationId, query.organizationId));
      }
      return db.select().from(customers);
    },

    async insert(input: Omit<CreateCustomerInput, "currency">): Promise<Customer> {
      const [row] = await db
        .insert(customers)
        .values({
          name: input.name,
          organizationId: input.organizationId,
        })
        .returning();

      return row!;
    },

    async update(
      id: string,
      input: UpdateCustomerInput
    ): Promise<Customer | null> {
      const [row] = await db
        .update(customers)
        .set({
          ...input,
          updatedAt: new Date(),
        })
        .where(eq(customers.id, id))
        .returning();

      return row ?? null;
    },

    async delete(id: string): Promise<boolean> {
      const result = await db
        .delete(customers)
        .where(eq(customers.id, id))
        .returning({ id: customers.id });

      return result.length > 0;
    },
  };
}
