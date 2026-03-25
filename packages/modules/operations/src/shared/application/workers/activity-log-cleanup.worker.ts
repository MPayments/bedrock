import { inArray, lt } from "drizzle-orm";

import type { Logger } from "@bedrock/platform/observability/logger";
import type { Queryable } from "@bedrock/platform/persistence";

import { opsActivityLog } from "../../../infra/drizzle/schema";

const RETENTION_DAYS = 180;
const BATCH_SIZE = 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface ActivityLogCleanupWorkerDeps {
  db: Queryable;
  logger: Logger;
}

export async function processActivityLogCleanup(
  deps: ActivityLogCleanupWorkerDeps,
): Promise<{ totalDeleted: number; batches: number }> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);
  const cutoffStr = cutoffDate.toISOString();

  deps.logger.info("Starting activity log cleanup", {
    cutoffDate: cutoffStr,
  });

  let totalDeleted = 0;
  let batchCount = 0;

  // Delete in batches to avoid blocking the DB
  while (true) {
    const oldLogs = await deps.db
      .select({ id: opsActivityLog.id })
      .from(opsActivityLog)
      .where(lt(opsActivityLog.createdAt, cutoffStr))
      .limit(BATCH_SIZE);

    if (oldLogs.length === 0) break;

    const idsToDelete = oldLogs.map((log) => log.id);

    await deps.db
      .delete(opsActivityLog)
      .where(inArray(opsActivityLog.id, idsToDelete));

    totalDeleted += idsToDelete.length;
    batchCount++;

    deps.logger.debug("Deleted batch of old activity logs", {
      batch: batchCount,
      deleted: oldLogs.length,
    });

    // Pause between batches to reduce DB load
    await sleep(100);
  }

  deps.logger.info("Activity log cleanup completed", {
    totalDeleted,
    batches: batchCount,
  });

  return { totalDeleted, batches: batchCount };
}
