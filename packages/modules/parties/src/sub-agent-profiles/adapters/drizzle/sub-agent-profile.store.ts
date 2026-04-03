import { eq, sql } from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";

import { subAgentProfiles } from "./schema";
import type {
  CreateStoredSubAgentProfileInput,
  StoredSubAgentProfile,
  SubAgentProfileStore,
  UpdateStoredSubAgentProfileInput,
} from "../../application/ports/sub-agent-profile.store";

export class DrizzleSubAgentProfileStore implements SubAgentProfileStore {
  constructor(private readonly db: Queryable) {}

  async findById(counterpartyId: string): Promise<StoredSubAgentProfile | null> {
    const [row] = await this.db
      .select()
      .from(subAgentProfiles)
      .where(eq(subAgentProfiles.counterpartyId, counterpartyId))
      .limit(1);

    return row ?? null;
  }

  async create(
    input: CreateStoredSubAgentProfileInput,
  ): Promise<StoredSubAgentProfile> {
    const [created] = await this.db
      .insert(subAgentProfiles)
      .values({
        commissionRate: input.commissionRate,
        counterpartyId: input.counterpartyId,
        isActive: input.isActive,
      })
      .returning();

    return created!;
  }

  async update(
    input: UpdateStoredSubAgentProfileInput,
  ): Promise<StoredSubAgentProfile | null> {
    const values: Record<string, unknown> = {};

    if (input.commissionRate !== undefined) {
      values.commissionRate = input.commissionRate;
    }

    if (input.isActive !== undefined) {
      values.isActive = input.isActive;
    }

    values.updatedAt = sql`now()`;

    const [updated] = await this.db
      .update(subAgentProfiles)
      .set(values)
      .where(eq(subAgentProfiles.counterpartyId, input.counterpartyId))
      .returning();

    return updated ?? null;
  }
}
