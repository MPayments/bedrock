import type { Queryable } from "@bedrock/platform/persistence";

import { opsActivityLog } from "../../../infra/drizzle/schema";
import type { LogActivityInput } from "../../application/contracts/commands";
import type { ActivityLogStore } from "../../application/ports/activity-log.store";

export class DrizzleActivityLogStore implements ActivityLogStore {
  constructor(private readonly db: Queryable) {}

  async insert(input: LogActivityInput): Promise<void> {
    await this.db.insert(opsActivityLog).values({
      userId: input.userId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      entityTitle: input.entityTitle,
      source: input.source ?? "web",
      metadata: input.metadata,
    });
  }
}
