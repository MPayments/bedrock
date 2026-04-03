import { eq, inArray } from "drizzle-orm";

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
    input: Omit<ReconciliationMatchRecord, "id" | "createdAt">[],
  ) => Promise<void>;
}

export function createDrizzleReconciliationMatchesRepository(
  db: Database,
) {
  const repository: DrizzleReconciliationMatchesRepository = {
    async findById(id) {
      const [match] = await db
        .select()
        .from(schema.reconciliationMatches)
        .where(eq(schema.reconciliationMatches.id, id))
        .limit(1);

      return match ?? null;
    },

    async listByMatchedOperationIds(operationIds) {
      if (operationIds.length === 0) {
        return [];
      }

      return db
        .select()
        .from(schema.reconciliationMatches)
        .where(
          inArray(schema.reconciliationMatches.matchedOperationId, operationIds),
        );
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
