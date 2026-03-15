import { eq, sql } from "drizzle-orm";

import type { Database, Transaction } from "@bedrock/platform/persistence";

import type { DocumentSnapshotsRepository } from "../../../application/documents/ports";
import { schema } from "../schema";

export function createDrizzleDocumentSnapshotsRepository(
  db: Database | Transaction,
): DocumentSnapshotsRepository {
  return {
    async findDocumentSnapshot(documentId) {
      const [snapshot] = await db
        .select()
        .from(schema.documentSnapshots)
        .where(eq(schema.documentSnapshots.documentId, documentId))
        .limit(1);

      return snapshot ?? null;
    },
    async insertDocumentSnapshot(snapshot) {
      await db.insert(schema.documentSnapshots).values({
        ...snapshot,
        createdAt: sql`now()`,
      });
    },
  };
}
