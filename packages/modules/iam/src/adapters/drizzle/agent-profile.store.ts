import type { Queryable } from "@bedrock/platform/persistence";

import { agentProfiles } from "./schema/business-schema";
import type { AgentProfileStore } from "../../application/users/ports";

export class DrizzleAgentProfileStore implements AgentProfileStore {
  constructor(private readonly db: Queryable) {}

  async ensureProvisioned(input: { userId: string; now: Date }): Promise<void> {
    await this.db
      .insert(agentProfiles)
      .values({
        userId: input.userId,
        status: "active",
        isAllowed: false,
        createdAt: input.now,
        updatedAt: input.now,
      })
      .onConflictDoNothing();
  }
}
