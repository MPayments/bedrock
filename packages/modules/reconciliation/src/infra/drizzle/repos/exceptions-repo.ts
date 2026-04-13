import { and, desc, eq, sql } from "drizzle-orm";

import type { Database, Transaction } from "@bedrock/platform/persistence";

import type {
  ReconciliationExceptionListRow,
  ReconciliationExceptionRecord,
} from "../../../application/exceptions/ports";
import { ReconciliationRunSummarySchema } from "../../../contracts";
import { schema } from "../schema";

interface DrizzleReconciliationExceptionsRepository {
  findByIdForUpdateTx: (
    tx: Transaction,
    id: string,
  ) => Promise<ReconciliationExceptionRecord | null>;
  createManyTx: (
    tx: Transaction,
    input: (
      Omit<
        ReconciliationExceptionRecord,
        "id" | "createdAt" | "resolvedAt" | "adjustmentDocumentId"
      >
    )[],
  ) => Promise<void>;
  list: (input: {
    source?: string;
    state?: ReconciliationExceptionRecord["state"];
    limit: number;
    offset: number;
  }) => Promise<ReconciliationExceptionListRow[]>;
  listLinkedToOperationIds: (
    operationIds: string[],
  ) => Promise<ReconciliationExceptionListRow[]>;
  markResolvedTx: (
    tx: Transaction,
    input: {
      id: string;
      adjustmentDocumentId: string;
      resolvedAt: Date;
    },
  ) => Promise<void>;
  markIgnoredTx: (
    tx: Transaction,
    input: {
      id: string;
      ignoredAt: Date;
    },
  ) => Promise<void>;
}

function toRunRecord(run: typeof schema.reconciliationRuns.$inferSelect) {
  return {
    ...run,
    resultSummary: ReconciliationRunSummarySchema.parse(run.resultSummary),
  };
}

function getOperationIdsArraySql(operationIds: string[]) {
  return sql`ARRAY[${sql.join(
    operationIds.map((operationId) => sql`${operationId}`),
    sql`, `,
  )}]::text[]`;
}

export function createDrizzleReconciliationExceptionsRepository(
  db: Database,
) {
  const repository: DrizzleReconciliationExceptionsRepository = {
    async findByIdForUpdateTx(tx: Transaction, id) {
      const [exception] = await tx
        .select()
        .from(schema.reconciliationExceptions)
        .where(eq(schema.reconciliationExceptions.id, id))
        .limit(1)
        .for("update");

      return exception ?? null;
    },

    async createManyTx(tx: Transaction, input) {
      if (input.length === 0) {
        return;
      }

      await tx.insert(schema.reconciliationExceptions).values(input);
    },

    async list(input) {
      const filters = [];

      if (input.state) {
        filters.push(eq(schema.reconciliationExceptions.state, input.state));
      }

      if (input.source) {
        filters.push(eq(schema.reconciliationRuns.source, input.source));
      }

      return db
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

    async listLinkedToOperationIds(operationIds) {
      if (operationIds.length === 0) {
        return [];
      }

      const operationIdsSql = getOperationIdsArraySql(operationIds);

      return db
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
        .where(
          sql`(
              ${schema.reconciliationExternalRecords.normalizedPayload} ->> 'operationId'
            ) = ANY(${operationIdsSql})
            OR EXISTS (
              SELECT 1
              FROM jsonb_array_elements_text(
                COALESCE(
                  ${schema.reconciliationExternalRecords.normalizedPayload} -> 'candidateOperationIds',
                  '[]'::jsonb
                )
              ) AS candidate(value)
              WHERE candidate.value = ANY(${operationIdsSql})
            )`,
        )
        .orderBy(desc(schema.reconciliationExceptions.createdAt))
        .then((rows) =>
          rows.map((row) => ({
            ...row,
            run: toRunRecord(row.run),
          })),
        );
    },

    async markResolvedTx(tx: Transaction, input) {
      await tx
        .update(schema.reconciliationExceptions)
        .set({
          state: "resolved",
          adjustmentDocumentId: input.adjustmentDocumentId,
          resolvedAt: input.resolvedAt,
        })
        .where(eq(schema.reconciliationExceptions.id, input.id));
    },

    async markIgnoredTx(tx: Transaction, input) {
      await tx
        .update(schema.reconciliationExceptions)
        .set({
          state: "ignored",
          resolvedAt: input.ignoredAt,
        })
        .where(eq(schema.reconciliationExceptions.id, input.id));
    },
  };

  return repository;
}
