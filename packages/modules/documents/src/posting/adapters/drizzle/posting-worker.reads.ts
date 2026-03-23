import { and, eq, inArray, sql } from "drizzle-orm";

import type { Database } from "@bedrock/platform/persistence";

import { schema } from "../../../schema";
import type {
  DocumentPostingWorkerItem,
  DocumentsPostingWorkerReads,
} from "../../application/ports/posting-worker.reads";

export class DrizzleDocumentsPostingWorkerReads
  implements DocumentsPostingWorkerReads
{
  constructor(private readonly db: Database) {}

  async claimPostingResults(
    input: { limit: number },
  ): Promise<DocumentPostingWorkerItem[]> {
    const rows = await this.db.transaction(async (tx) =>
      tx
        .select({
          document: schema.documents,
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
        .where(
          and(
            eq(schema.documents.postingStatus, "posting"),
            inArray(schema.ledgerOperations.status, ["posted", "failed"]),
          ),
        )
        .for("update", { skipLocked: true })
        .limit(input.limit),
    );

    const items: DocumentPostingWorkerItem[] = [];
    for (const row of rows) {
      if (row.ledgerStatus !== "posted" && row.ledgerStatus !== "failed") {
        continue;
      }

      items.push({
        document: row.document,
        operationId: row.operationId,
        ledgerStatus: row.ledgerStatus,
        postedAt: row.postedAt,
        error: row.error,
      });
    }

    return items;
  }

  async listOperationBookIds(operationIds: string[]) {
    if (operationIds.length === 0) {
      return new Map<string, string[]>();
    }

    const result = await this.db.execute(sql`
      SELECT DISTINCT
        operation_id::text AS operation_id,
        book_id::text AS book_id
      FROM ${schema.postings}
      WHERE operation_id IN (${sql.join(operationIds.map((id) => sql`${id}::uuid`), sql`, `)})
    `);
    const rows = (result.rows ?? []) as {
      operation_id: string;
      book_id: string;
    }[];

    const byOperation = new Map<string, Set<string>>();
    for (const row of rows) {
      const bucket = byOperation.get(row.operation_id) ?? new Set<string>();
      bucket.add(row.book_id);
      byOperation.set(row.operation_id, bucket);
    }

    return new Map(
      [...byOperation.entries()].map(([operationId, bookIds]) => [
        operationId,
        [...bookIds],
      ]),
    );
  }
}
