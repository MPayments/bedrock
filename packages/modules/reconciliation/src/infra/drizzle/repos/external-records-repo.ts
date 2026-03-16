import { and, eq, inArray } from "drizzle-orm";

import type { Transaction } from "@bedrock/platform/persistence";

import type { ReconciliationExternalRecordRecord } from "../../../application/records/ports";
import { schema } from "../schema";

interface DrizzleReconciliationExternalRecordsRepository {
  findBySourceAndSourceRecordIdTx: (
    tx: Transaction,
    input: { source: string; sourceRecordId: string },
  ) => Promise<ReconciliationExternalRecordRecord | null>;
  createTx: (
    tx: Transaction,
    input: Omit<ReconciliationExternalRecordRecord, "id" | "receivedAt">,
  ) => Promise<ReconciliationExternalRecordRecord>;
  listForRunTx: (
    tx: Transaction,
    input: { source: string; externalRecordIds?: string[] },
  ) => Promise<ReconciliationExternalRecordRecord[]>;
}

export function createDrizzleReconciliationExternalRecordsRepository() {
  const repository: DrizzleReconciliationExternalRecordsRepository = {
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

  return repository;
}
