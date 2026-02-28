import { and, eq, inArray, sql } from "drizzle-orm";

import type { Database } from "@bedrock/db";
import { schema } from "@bedrock/db/schema";

export function createDocumentsWorker(deps: { db: Database }) {
  const { db } = deps;

  async function processOnce(opts?: { batchSize?: number }) {
    const batchSize = opts?.batchSize ?? 50;

    const claimed = await db.transaction(async (tx) => {
      const rows = await tx
        .select({
          id: schema.documents.id,
          operationId: schema.documentOperations.operationId,
          ledgerStatus: schema.ledgerOperations.status,
          postedAt: schema.ledgerOperations.postedAt,
          error: schema.ledgerOperations.error,
        })
        .from(schema.documents)
        .innerJoin(
          schema.documentOperations,
          and(
            eq(schema.documentOperations.documentId, schema.documents.id),
            eq(schema.documentOperations.kind, "post"),
          ),
        )
        .innerJoin(
          schema.ledgerOperations,
          eq(schema.ledgerOperations.id, schema.documentOperations.operationId),
        )
        .where(eq(schema.documents.postingStatus, "posting"))
        .for("update", { skipLocked: true })
        .limit(batchSize);

      return rows;
    });

    let finalized = 0;

    for (const row of claimed) {
      if (row.ledgerStatus !== "posted" && row.ledgerStatus !== "failed") {
        continue;
      }

      const [updated] = await db
        .update(schema.documents)
        .set({
          postingStatus: row.ledgerStatus === "posted" ? "posted" : "failed",
          postedAt: row.ledgerStatus === "posted" ? (row.postedAt ?? new Date()) : null,
          postingError: row.ledgerStatus === "failed" ? row.error : null,
          updatedAt: sql`now()`,
          version: sql`${schema.documents.version} + 1`,
        })
        .where(
          and(
            eq(schema.documents.id, row.id),
            eq(schema.documents.postingStatus, "posting"),
          ),
        )
        .returning({ id: schema.documents.id });

      if (updated) {
        finalized += 1;
      }
    }

    return finalized;
  }

  return {
    processOnce,
  };
}
