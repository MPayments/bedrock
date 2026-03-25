import type { Logger } from "@bedrock/platform/observability/logger";
import type { Queryable } from "@bedrock/platform/persistence";
import { eq } from "drizzle-orm";

import { opsS3CleanupQueue } from "../../../infra/drizzle/schema";
import type { ObjectStoragePort } from "../ports/object-storage.port";

const BATCH_LIMIT = 500;

export interface S3CleanupWorkerDeps {
  db: Queryable;
  objectStorage: ObjectStoragePort;
  logger: Logger;
}

export async function processS3CleanupQueue(
  deps: S3CleanupWorkerDeps,
): Promise<{ successCount: number; failedCount: number }> {
  const queueItems = await deps.db
    .select()
    .from(opsS3CleanupQueue)
    .limit(BATCH_LIMIT);

  if (queueItems.length === 0) {
    deps.logger.debug("S3 cleanup queue is empty");
    return { successCount: 0, failedCount: 0 };
  }

  deps.logger.info("Processing S3 cleanup queue", {
    count: queueItems.length,
  });

  const successfulIds: number[] = [];
  const failedItems: { id: number; s3Key: string; error: string }[] = [];

  for (const item of queueItems) {
    try {
      await deps.objectStorage.delete(item.s3Key);
      successfulIds.push(item.id);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      failedItems.push({ id: item.id, s3Key: item.s3Key, error: errorMessage });
      deps.logger.warn("Failed to delete S3 file, will retry later", {
        s3Key: item.s3Key,
        error: errorMessage,
      });
    }
  }

  // Remove successfully processed items from queue
  for (const id of successfulIds) {
    await deps.db
      .delete(opsS3CleanupQueue)
      .where(eq(opsS3CleanupQueue.id, id));
  }

  deps.logger.info("S3 cleanup batch completed", {
    successCount: successfulIds.length,
    failedCount: failedItems.length,
  });

  return {
    successCount: successfulIds.length,
    failedCount: failedItems.length,
  };
}
