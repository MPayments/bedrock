import { and, desc, eq } from "drizzle-orm";

import type { ReconciliationExceptionsRepository } from "../../../application/exceptions/ports";
import { ReconciliationRunSummarySchema } from "../../../contracts";
import { schema } from "../schema";

function toRunRecord(run: typeof schema.reconciliationRuns.$inferSelect) {
  return {
    ...run,
    resultSummary: ReconciliationRunSummarySchema.parse(run.resultSummary),
  };
}

export function createDrizzleReconciliationExceptionsRepository(): ReconciliationExceptionsRepository {
  return {
    async findByIdForUpdate(executor, id) {
      const [exception] = await executor
        .select()
        .from(schema.reconciliationExceptions)
        .where(eq(schema.reconciliationExceptions.id, id))
        .limit(1)
        .for("update");

      return exception ?? null;
    },

    async createMany(executor, input) {
      if (input.length === 0) {
        return;
      }

      await executor.insert(schema.reconciliationExceptions).values(input);
    },

    async list(executor, input) {
      const filters = [];

      if (input.state) {
        filters.push(eq(schema.reconciliationExceptions.state, input.state));
      }

      if (input.source) {
        filters.push(eq(schema.reconciliationRuns.source, input.source));
      }

      return executor
        .select({
          exception: schema.reconciliationExceptions,
          run: schema.reconciliationRuns,
          externalRecord: schema.reconciliationExternalRecords,
        })
        .from(schema.reconciliationExceptions)
        .innerJoin(
          schema.reconciliationRuns,
          eq(schema.reconciliationExceptions.runId, schema.reconciliationRuns.id),
        )
        .innerJoin(
          schema.reconciliationExternalRecords,
          eq(
            schema.reconciliationExceptions.externalRecordId,
            schema.reconciliationExternalRecords.id,
          ),
        )
        .where(filters.length > 0 ? and(...filters) : undefined)
        .orderBy(desc(schema.reconciliationExceptions.createdAt))
        .limit(input.limit)
        .offset(input.offset)
        .then((rows) =>
          rows.map((row) => ({
            ...row,
            run: toRunRecord(row.run),
          })),
        );
    },

    async markResolved(executor, input) {
      await executor
        .update(schema.reconciliationExceptions)
        .set({
          state: "resolved",
          adjustmentDocumentId: input.adjustmentDocumentId,
          resolvedAt: input.resolvedAt,
        })
        .where(eq(schema.reconciliationExceptions.id, input.id));
    },
  };
}
