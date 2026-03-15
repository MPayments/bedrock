import { eq } from "drizzle-orm";

import type { ReconciliationMatchesRepository } from "../../../application/runs/ports";
import { schema } from "../schema";

export function createDrizzleReconciliationMatchesRepository(): ReconciliationMatchesRepository {
  return {
    async findById(executor, id) {
      const [match] = await executor
        .select()
        .from(schema.reconciliationMatches)
        .where(eq(schema.reconciliationMatches.id, id))
        .limit(1);

      return match ?? null;
    },

    async createMany(executor, input) {
      if (input.length === 0) {
        return;
      }

      await executor.insert(schema.reconciliationMatches).values(input);
    },
  };
}
