import { and, eq, inArray } from "drizzle-orm";
import type { Transaction } from "@bedrock/platform/persistence";

import type { ReconciliationExternalRecordsRepository } from "../../../application/records/ports";
import { schema } from "../schema";

export function createDrizzleReconciliationExternalRecordsRepository(): ReconciliationExternalRecordsRepository {
  return {
    async findBySourceAndSourceRecordIdTx(tx, input) {
      const [record] = await tx
        .select()
        .from(schema.reconciliationExternalRecords)
        .where(
          and(
            eq(schema.reconciliationExternalRecords.source, input.source),
            eq(
              schema.reconciliationExternalRecords.sourceRecordId,
              input.sourceRecordId,
            ),
          ),
        )
        .limit(1);

      return record ?? null;
    },

    async createTx(tx, input) {
      const [record] = await tx
        .insert(schema.reconciliationExternalRecords)
        .values(input)
        .returning();

      return record!;
    },

    async listForRunTx(tx: Transaction, input) {
      const filters = [eq(schema.reconciliationExternalRecords.source, input.source)];

      if (input.externalRecordIds?.length) {
        filters.push(
          inArray(
            schema.reconciliationExternalRecords.id,
            input.externalRecordIds,
          ),
        );
      }

      return tx
        .select()
        .from(schema.reconciliationExternalRecords)
        .where(and(...filters))
        .orderBy(
          schema.reconciliationExternalRecords.receivedAt,
          schema.reconciliationExternalRecords.id,
        );
    },
  };
}
