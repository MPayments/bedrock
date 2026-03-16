import { and, eq, sql } from "drizzle-orm";

import type { Database, Transaction } from "@bedrock/platform/persistence";

import type { DocumentsCommandRepository } from "../../../application/documents/ports";
import type { DocumentSnapshot } from "../../../domain/document";
import { schema } from "../schema";

export function createDrizzleDocumentsCommandRepository(
  db: Database | Transaction,
): DocumentsCommandRepository {
  return {
    async findDocumentByType(input) {
      const selection = db
        .select()
        .from(schema.documents)
        .where(
          and(
            eq(schema.documents.id, input.documentId),
            eq(schema.documents.docType, input.docType),
          ),
        )
        .limit(1);
      const [document] = input.forUpdate
        ? await selection.for("update")
        : await selection;

      return document ?? null;
    },
    async findDocumentByCreateIdempotencyKey(input) {
      const [document] = await db
        .select()
        .from(schema.documents)
        .where(
          and(
            eq(schema.documents.docType, input.docType),
            eq(
              schema.documents.createIdempotencyKey,
              input.createIdempotencyKey,
            ),
          ),
        )
        .limit(1);

      return document ?? null;
    },
    async insertDocument(document: DocumentSnapshot) {
      const [inserted] = await db
        .insert(schema.documents)
        .values(document)
        .onConflictDoNothing()
        .returning();

      return inserted ?? null;
    },
    async updateDocument(input) {
      const [updated] = await db
        .update(schema.documents)
        .set({
          ...input.patch,
          version: sql`${schema.documents.version} + 1`,
        })
        .where(
          and(
            eq(schema.documents.id, input.documentId),
            eq(schema.documents.docType, input.docType),
          ),
        )
        .returning();

      return updated ?? null;
    },
  };
}
