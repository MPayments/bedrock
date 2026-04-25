import { eq, sql } from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";
import { hasPostgresForeignKeyViolation } from "@bedrock/platform/persistence/postgres-errors";

import { organizations } from "./schema";
import type { OrganizationStore } from "../../application/ports/organization.store";

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
    externalRef: string | null;
    shortName: string;
    fullName: string;
    description: string | null;
    country: string | null;
    kind: "legal_entity" | "individual";
    isActive: boolean;
    signatureKey: string | null;
    sealKey: string | null;
  }) {
    const [created] = await this.db
      .insert(organizations)
      .values(organization)
      .returning();

    return created!;
  }

  async update(organization: {
    id: string;
    externalRef: string | null;
    shortName: string;
    fullName: string;
    description: string | null;
    country: string | null;
    kind: "legal_entity" | "individual";
    isActive: boolean;
    signatureKey: string | null;
    sealKey: string | null;
  }) {
    const [updated] = await this.db
      .update(organizations)
      .set({
        externalRef: organization.externalRef,
        shortName: organization.shortName,
        fullName: organization.fullName,
        description: organization.description,
        country: organization.country,
        kind: organization.kind,
        isActive: organization.isActive,
        signatureKey: organization.signatureKey,
        sealKey: organization.sealKey,
        updatedAt: sql`now()`,
      })
      .where(eq(organizations.id, organization.id))
      .returning();

    return updated ?? null;
  }

  async remove(id: string) {
    try {
      const [deleted] = await this.db
        .update(organizations)
        .set({
          isActive: false,
          updatedAt: sql`now()`,
        })
        .where(eq(organizations.id, id))
        .returning({ id: organizations.id });

      return deleted ? "deleted" : "not_found";
    } catch (error) {
      if (hasPostgresForeignKeyViolation(error)) {
        return "conflict";
      }

      throw error;
    }
  }
}
