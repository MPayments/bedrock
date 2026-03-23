import { eq, or } from "drizzle-orm";

import type { Queryable, Transaction } from "@bedrock/platform/persistence";

import { insertInitialLinks } from "./graph";
import { schema } from "./schema";
import type {
  DocumentLinksRepository,
  InsertInitialDocumentLinksInput,
} from "../../application/ports";

export class DrizzleDocumentLinksRepository implements DocumentLinksRepository {
  constructor(private readonly db: Queryable) {}

  async insertInitialLinks(input: InsertInitialDocumentLinksInput) {
    await insertInitialLinks(
      this.db as Transaction,
      input.document,
      input.links,
    );
  }

  listDocumentLinks(documentId: string) {
    return this.db
      .select()
      .from(schema.documentLinks)
      .where(
        or(
          eq(schema.documentLinks.fromDocumentId, documentId),
          eq(schema.documentLinks.toDocumentId, documentId),
        ),
      );
  }
}
