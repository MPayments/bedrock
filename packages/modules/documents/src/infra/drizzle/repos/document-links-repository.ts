import { eq, or } from "drizzle-orm";

import type { Database, Transaction } from "@bedrock/platform/persistence";

import type { DocumentLinksRepository } from "../../../application/documents/ports";
import { insertInitialLinks } from "../graph";
import { schema } from "../schema";

export function createDrizzleDocumentLinksRepository(
  db: Database | Transaction,
): DocumentLinksRepository {
  return {
    async insertInitialLinks(input) {
      await insertInitialLinks(db as Transaction, input.document, input.links);
    },
    async listDocumentLinks(documentId) {
      return db
        .select()
        .from(schema.documentLinks)
        .where(
          or(
            eq(schema.documentLinks.fromDocumentId, documentId),
            eq(schema.documentLinks.toDocumentId, documentId),
          ),
        );
    },
  };
}
