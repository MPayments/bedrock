import { and, eq, sql } from "drizzle-orm";

import type { Database, Transaction } from "@bedrock/platform/persistence";

import { schema } from "./schema";
import type {
  DocumentsCommandRepository,
  FindDocumentByCreateIdempotencyKeyInput,
  FindDocumentByTypeCommandInput,
  UpdateDocumentInput,
} from "../../application/ports";
import type { DocumentSnapshot } from "../../domain/document";

export class DrizzleDocumentsRepository implements DocumentsCommandRepository {
  constructor(private readonly db: Database | Transaction) {}

  async findDocumentByType(input: FindDocumentByTypeCommandInput) {
    const selection = this.db
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
  }

  async findDocumentByCreateIdempotencyKey(
    input: FindDocumentByCreateIdempotencyKeyInput,
  ) {
    const [document] = await this.db
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
  }

  async insertDocument(document: DocumentSnapshot) {
    const [inserted] = await this.db
      .insert(schema.documents)
      .values(document)
      .onConflictDoNothing()
      .returning();

    return inserted ?? null;
  }

  async updateDocument(input: UpdateDocumentInput) {
    const [updated] = await this.db
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
  }
}
