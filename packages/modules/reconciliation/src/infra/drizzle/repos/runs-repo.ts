import { eq } from "drizzle-orm";

import type { ReconciliationRunsRepositoryPort } from "../../../application/ports";
import { ReconciliationRunSummarySchema } from "../../../contracts";
import { schema } from "../schema";

function toRunRecord(run: typeof schema.reconciliationRuns.$inferSelect) {
  return {
    ...run,
    resultSummary: ReconciliationRunSummarySchema.parse(run.resultSummary),
  };
}

export function createDrizzleReconciliationRunsRepository(): ReconciliationRunsRepositoryPort {
  return {
    async findById(executor, id) {
      const [run] = await executor
        .select()
        .from(schema.reconciliationRuns)
        .where(eq(schema.reconciliationRuns.id, id))
        .limit(1);

      return run ? toRunRecord(run) : null;
    },

    async create(executor, input) {
      const [run] = await executor
        .insert(schema.reconciliationRuns)
        .values(input)
        .returning();

      return toRunRecord(run!);
    },
  };
}
