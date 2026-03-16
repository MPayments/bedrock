import { eq } from "drizzle-orm";

import type { Transaction } from "@bedrock/platform/persistence";

import type { ReconciliationRunRecord } from "../../../application/runs/ports";
import { ReconciliationRunSummarySchema } from "../../../contracts";
import { schema } from "../schema";

interface DrizzleReconciliationRunsRepository {
  findByIdTx: (
    tx: Transaction,
    id: string,
  ) => Promise<ReconciliationRunRecord | null>;
  createTx: (
    tx: Transaction,
    input: Omit<ReconciliationRunRecord, "id" | "createdAt">,
  ) => Promise<ReconciliationRunRecord>;
}

function toRunRecord(run: typeof schema.reconciliationRuns.$inferSelect) {
  return {
    ...run,
    resultSummary: ReconciliationRunSummarySchema.parse(run.resultSummary),
  };
}

export function createDrizzleReconciliationRunsRepository() {
  const repository: DrizzleReconciliationRunsRepository = {
    async findByIdTx(tx, id) {
      const [run] = await tx
        .select()
        .from(schema.reconciliationRuns)
        .where(eq(schema.reconciliationRuns.id, id))
        .limit(1);

      return run ? toRunRecord(run) : null;
    },

    async createTx(tx, input) {
      const [run] = await tx
        .insert(schema.reconciliationRuns)
        .values(input)
        .returning();

      return toRunRecord(run!);
    },
  };

  return repository;
}
