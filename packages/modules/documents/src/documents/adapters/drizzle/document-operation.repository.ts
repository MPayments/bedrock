import { and, eq, sql } from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";

import { schema } from "./schema";
import type {
  DocumentOperationsRepository,
  FindPostingOperationIdInput,
  InsertDocumentOperationInput,
  ResetPostingOperationInput,
} from "../../application/ports";

export class DrizzleDocumentOperationsRepository implements DocumentOperationsRepository {
  constructor(private readonly db: Queryable) {}

  async findPostingOperationId(input: FindPostingOperationIdInput) {
    const [row] = await this.db
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
  }

  async insertDocumentOperation(input: InsertDocumentOperationInput) {
    await this.db
      .insert(schema.documentOperations)
      .values({
        documentId: input.documentId,
        operationId: input.operationId,
        kind: input.kind,
      })
      .onConflictDoNothing();
  }

  async resetPostingOperation(input: ResetPostingOperationInput) {
    await this.db
      .update(schema.ledgerOperations)
      .set({
        status: "pending",
        error: null,
        postedAt: null,
      })
      .where(eq(schema.ledgerOperations.id, input.operationId));

    await this.db
      .update(schema.tbTransferPlans)
      .set({
        status: "pending",
        error: null,
      })
      .where(eq(schema.tbTransferPlans.operationId, input.operationId));

    await this.db
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
  }

  listDocumentOperations(documentId: string) {
    return this.db
      .select()
      .from(schema.documentOperations)
      .where(eq(schema.documentOperations.documentId, documentId));
  }
}
