import { eq } from "drizzle-orm";

import type { Database, Transaction } from "@bedrock/platform/persistence";

import type { DocumentBusinessLinksRepository } from "../../../application/documents/ports";
import { schema } from "../schema";

export function createDrizzleDocumentBusinessLinksRepository(
  db: Database | Transaction,
): DocumentBusinessLinksRepository {
  return {
    async insertDealLink(input) {
      await db
        .insert(schema.documentBusinessLinks)
        .values({
          dealId: input.dealId,
          documentId: input.documentId,
          linkKind: input.linkKind,
        })
        .onConflictDoNothing();
    },
    async findDealIdByDocumentId(documentId) {
      const [row] = await db
        .select({
          dealId: schema.documentBusinessLinks.dealId,
        })
        .from(schema.documentBusinessLinks)
        .where(eq(schema.documentBusinessLinks.documentId, documentId))
        .limit(1);

      return row?.dealId ?? null;
    },
  };
}
