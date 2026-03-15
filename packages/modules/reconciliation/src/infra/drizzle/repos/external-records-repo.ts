import { and, eq, inArray } from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";

import type { ReconciliationExternalRecordsRepositoryPort } from "../../../application/ports";
import { schema } from "../schema";

export function createDrizzleReconciliationExternalRecordsRepository(): ReconciliationExternalRecordsRepositoryPort {
  return {
    async findBySourceAndSourceRecordId(executor, input) {
      const [record] = await executor
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

    async create(executor, input) {
      const [record] = await executor
        .insert(schema.reconciliationExternalRecords)
        .values(input)
        .returning();

      return record!;
    },

    async listForRun(executor: Queryable, input) {
      const filters = [eq(schema.reconciliationExternalRecords.source, input.source)];

      if (input.externalRecordIds?.length) {
        filters.push(
          inArray(
            schema.reconciliationExternalRecords.id,
            input.externalRecordIds,
          ),
        );
      }

      return executor
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
