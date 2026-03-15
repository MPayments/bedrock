import { and, eq, sql } from "drizzle-orm";

import type { Database, Transaction } from "@bedrock/platform/persistence";

import type { DocumentOperationsRepository } from "../../../application/documents/ports";
import { schema } from "../schema";

export function createDrizzleDocumentOperationsRepository(
  db: Database | Transaction,
): DocumentOperationsRepository {
  return {
    async findPostingOperationId(input) {
      const [row] = await db
        .select({ operationId: schema.documentOperations.operationId })
        .from(schema.documentOperations)
        .where(
          and(
            eq(schema.documentOperations.documentId, input.documentId),
            eq(schema.documentOperations.kind, "post"),
          ),
        )
        .limit(1);

      return row?.operationId ?? null;
    },
    async insertDocumentOperation(input) {
      await db
        .insert(schema.documentOperations)
        .values({
          documentId: input.documentId,
          operationId: input.operationId,
          kind: input.kind,
        })
        .onConflictDoNothing();
    },
    async resetPostingOperation(input) {
      await db
        .update(schema.ledgerOperations)
        .set({
          status: "pending",
          error: null,
          postedAt: null,
        })
        .where(eq(schema.ledgerOperations.id, input.operationId));

      await db
        .update(schema.tbTransferPlans)
        .set({
          status: "pending",
          error: null,
        })
        .where(eq(schema.tbTransferPlans.operationId, input.operationId));

      await db
        .update(schema.outbox)
        .set({
          status: "pending",
          error: null,
          lockedAt: null,
          availableAt: sql`now()`,
        })
        .where(
          and(
            eq(schema.outbox.kind, "post_operation"),
            eq(schema.outbox.refId, input.operationId),
          ),
        );
    },
    async listDocumentOperations(documentId) {
      return db
        .select()
        .from(schema.documentOperations)
        .where(eq(schema.documentOperations.documentId, documentId));
    },
  };
}
