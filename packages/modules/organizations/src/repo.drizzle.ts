import { eq } from "drizzle-orm";
import type { Database } from "@repo/db";
import { organizations } from "@repo/db/schema";
import type { Organization, CreateOrganizationInput, UpdateOrganizationInput } from "./contract.js";

export const createOrganizationsRepo = (db: Database) => {
  return {
    async getById(id: string): Promise<Organization | null> {
      const rows = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, id))
        .limit(1);

      return rows[0] ?? null;
    },

    async list(): Promise<Organization[]> {
      return db.select().from(organizations);
    },

    async insert(input: CreateOrganizationInput): Promise<Organization> {
      const [row] = await db
        .insert(organizations)
        .values({
          type: input.type,
          name: input.name,
        })
        .returning();

      return row!;
    },

    async update(
      id: string,
      input: UpdateOrganizationInput
    ): Promise<Organization | null> {
      const [row] = await db
        .update(organizations)
        .set({
          ...input,
          updatedAt: new Date(),
        })
        .where(eq(organizations.id, id))
        .returning();

      return row ?? null;
    },

    async delete(id: string): Promise<boolean> {
      const result = await db
        .delete(organizations)
        .where(eq(organizations.id, id))
        .returning({ id: organizations.id });

      return result.length > 0;
    },
  };
}

export type OrganizationsRepo = ReturnType<typeof createOrganizationsRepo>;
