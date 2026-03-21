import { eq, sql } from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";

import { organizations } from "./schema";
import type { OrganizationStore } from "../../application/ports/organization.store";

function hasForeignKeyViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as { code?: unknown; cause?: unknown };
  if (candidate.code === "23503") {
    return true;
  }

  return hasForeignKeyViolation(candidate.cause);
}

export class DrizzleOrganizationStore implements OrganizationStore {
  constructor(private readonly db: Queryable) {}

  async findById(id: string) {
    const [row] = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, id))
      .limit(1);

    return row ?? null;
  }

  async create(organization: {
    id: string;
    externalId: string | null;
    shortName: string;
    fullName: string;
    description: string | null;
    country: string | null;
    kind: "legal_entity" | "individual";
  }) {
    const [created] = await this.db
      .insert(organizations)
      .values(organization)
      .returning();

    return created!;
  }

  async update(organization: {
    id: string;
    externalId: string | null;
    shortName: string;
    fullName: string;
    description: string | null;
    country: string | null;
    kind: "legal_entity" | "individual";
  }) {
    const [updated] = await this.db
      .update(organizations)
      .set({
        externalId: organization.externalId,
        shortName: organization.shortName,
        fullName: organization.fullName,
        description: organization.description,
        country: organization.country,
        kind: organization.kind,
        updatedAt: sql`now()`,
      })
      .where(eq(organizations.id, organization.id))
      .returning();

    return updated ?? null;
  }

  async remove(id: string) {
    try {
      const [deleted] = await this.db
        .delete(organizations)
        .where(eq(organizations.id, id))
        .returning({ id: organizations.id });

      return deleted ? "deleted" : "not_found";
    } catch (error) {
      if (hasForeignKeyViolation(error)) {
        return "conflict";
      }

      throw error;
    }
  }
}
