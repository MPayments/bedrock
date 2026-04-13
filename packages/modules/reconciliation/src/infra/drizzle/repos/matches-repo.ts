import { eq, inArray, or } from "drizzle-orm";

import type { Database, Transaction } from "@bedrock/platform/persistence";

import type { ReconciliationMatchRecord } from "../../../application/runs/ports";
import { schema } from "../schema";

interface DrizzleReconciliationMatchesRepository {
  findById: (id: string) => Promise<ReconciliationMatchRecord | null>;
  listByMatchedOperationIds: (
    operationIds: string[],
  ) => Promise<ReconciliationMatchRecord[]>;
  createManyTx: (
    tx: Transaction,
    input: Omit<
      ReconciliationMatchRecord,
      "id" | "createdAt" | "matchedOperationRef"
    >[],
  ) => Promise<void>;
}

export function createDrizzleReconciliationMatchesRepository(
  db: Database,
) {
  function toMatchRecord(
    row: typeof schema.reconciliationMatches.$inferSelect,
  ): ReconciliationMatchRecord {
    const matchedOperationRef = row.matchedTreasuryOperationId
      ? {
          id: row.matchedTreasuryOperationId,
          kind: "treasury" as const,
        }
      : row.matchedOperationId
        ? {
            id: row.matchedOperationId,
            kind: "ledger" as const,
          }
        : null;

    return {
      ...row,
      matchedOperationRef,
    };
  }

  const repository: DrizzleReconciliationMatchesRepository = {
    async findById(id) {
      const [match] = await db
        .select()
        .from(schema.reconciliationMatches)
        .where(eq(schema.reconciliationMatches.id, id))
        .limit(1);

      return match ? toMatchRecord(match) : null;
    },

    async listByMatchedOperationIds(operationIds) {
      if (operationIds.length === 0) {
        return [];
      }

      return db
        .select()
        .from(schema.reconciliationMatches)
        .where(
          or(
            inArray(schema.reconciliationMatches.matchedOperationId, operationIds),
            inArray(
              schema.reconciliationMatches.matchedTreasuryOperationId,
              operationIds,
            ),
          ),
        )
        .then((rows) => rows.map(toMatchRecord));
    },

    async createManyTx(tx: Transaction, input) {
      if (input.length === 0) {
        return;
      }

      await tx.insert(schema.reconciliationMatches).values(input);
    },
  };

  return repository;
}
