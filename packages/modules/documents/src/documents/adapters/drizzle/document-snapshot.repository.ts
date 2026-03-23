import { eq, sql } from "drizzle-orm";

import type { Database, Transaction } from "@bedrock/platform/persistence";

import { schema } from "./schema";
import type {
  DocumentSnapshotsRepository,
  InsertDocumentPostingSnapshotInput,
} from "../../application/ports";

export class DrizzleDocumentSnapshotsRepository
  implements DocumentSnapshotsRepository
{
  constructor(private readonly db: Database | Transaction) {}

  async findDocumentSnapshot(documentId: string) {
    const [snapshot] = await this.db
      .select()
      .from(schema.documentSnapshots)
      .where(eq(schema.documentSnapshots.documentId, documentId))
      .limit(1);

    return snapshot ?? null;
  }

  async insertDocumentSnapshot(snapshot: InsertDocumentPostingSnapshotInput) {
    await this.db.insert(schema.documentSnapshots).values({
      ...snapshot,
      createdAt: sql`now()`,
    });
  }
}
