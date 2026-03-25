import type { ModuleRuntime } from "@bedrock/shared/core";

import {
  LogActivityInputSchema,
  type LogActivityInput,
} from "../contracts/commands";
import type { ActivityLogStore } from "../ports/activity-log.store";

export class LogActivityCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly store: ActivityLogStore,
  ) {}

  async execute(input: LogActivityInput): Promise<void> {
    const validated = LogActivityInputSchema.parse(input);

    try {
      await this.store.insert(validated);
    } catch (error) {
      // Activity logging must never break the main flow
      this.runtime.log.error("Failed to log activity", {
        error: String(error),
        userId: validated.userId,
        action: validated.action,
        entityType: validated.entityType,
        entityId: validated.entityId,
      });
    }
  }
}
