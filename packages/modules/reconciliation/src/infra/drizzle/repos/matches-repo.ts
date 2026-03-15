import { eq } from "drizzle-orm";
import type { Database, Transaction } from "@bedrock/platform/persistence";

import type { ReconciliationMatchesRepository } from "../../../application/runs/ports";
import { schema } from "../schema";

export function createDrizzleReconciliationMatchesRepository(
  db: Database,
): ReconciliationMatchesRepository {
  return {
    async findById(id) {
      const [match] = await db
        .select()
        .from(schema.reconciliationMatches)
        .where(eq(schema.reconciliationMatches.id, id))
        .limit(1);

      return match ?? null;
    },

    async createManyTx(tx: Transaction, input) {
      if (input.length === 0) {
        return;
      }

      await tx.insert(schema.reconciliationMatches).values(input);
    },
  };
}
