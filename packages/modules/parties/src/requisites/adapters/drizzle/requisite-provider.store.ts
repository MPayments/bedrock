import { and, eq, isNull } from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";

import { requisiteProviders } from "./schema";
import type { RequisiteProviderStore } from "../../application/ports/requisite-provider.store";

export class DrizzleRequisiteProviderStore implements RequisiteProviderStore {
  constructor(private readonly db: Queryable) {}

  async findActiveById(id: string) {
    const [row] = await this.db
      .select()
      .from(requisiteProviders)
      .where(
        and(eq(requisiteProviders.id, id), isNull(requisiteProviders.archivedAt)),
      )
      .limit(1);

    return row ?? null;
  }

  async create(provider: {
    id: string;
    kind: "bank" | "exchange" | "blockchain" | "custodian";
    name: string;
    description: string | null;
    country: string | null;
    address: string | null;
    contact: string | null;
    bic: string | null;
    swift: string | null;
    archivedAt: Date | null;
  }) {
    const [created] = await this.db
      .insert(requisiteProviders)
      .values({
        ...provider,
      })
      .returning();

    return created!;
  }

  async update(provider: {
    id: string;
    kind: "bank" | "exchange" | "blockchain" | "custodian";
    name: string;
    description: string | null;
    country: string | null;
    address: string | null;
    contact: string | null;
    bic: string | null;
    swift: string | null;
    archivedAt: Date | null;
  }) {
    const [updated] = await this.db
      .update(requisiteProviders)
      .set({
        kind: provider.kind,
        name: provider.name,
        description: provider.description,
        country: provider.country,
        address: provider.address,
        contact: provider.contact,
        bic: provider.bic,
        swift: provider.swift,
        archivedAt: provider.archivedAt,
      })
      .where(eq(requisiteProviders.id, provider.id))
      .returning();

    return updated ?? null;
  }

  async archive(id: string, archivedAt: Date): Promise<boolean> {
    const [row] = await this.db
      .update(requisiteProviders)
      .set({
        archivedAt,
        updatedAt: archivedAt,
      })
      .where(eq(requisiteProviders.id, id))
      .returning({ id: requisiteProviders.id });

    return Boolean(row);
  }
}
