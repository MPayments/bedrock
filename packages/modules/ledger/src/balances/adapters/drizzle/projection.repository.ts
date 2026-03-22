import { and, eq, sql } from "drizzle-orm";

import type { Transaction } from "@bedrock/platform/persistence";

import { schema as balancesSchema } from "./schema";
import { schema as ledgerSchema } from "../../../adapters/drizzle/schema/index";
import type { BalancesProjectionRepository } from "../../application/projection/ports";
import {
  hasConsistentCursor,
  type BalanceProjectorCursor,
  type ProjectedBalanceDelta,
  type ProjectionOperationRow,
  type ProjectionPostingRow,
} from "../../domain/projection";

const schema = {
  ...balancesSchema,
  ...ledgerSchema,
};

const BALANCE_PROJECTOR_WORKER_KEY = "ledger_posted";
const BALANCE_EVENT_TYPE = "ledger_posted";

export class DrizzleBalancesProjectionRepository implements BalancesProjectionRepository {
  constructor(private readonly tx: Transaction) {}

  ensureCursor(): Promise<BalanceProjectorCursor> {
    return this.doEnsureCursor();
  }

  listOperationsAfterCursor(cursor: BalanceProjectorCursor, batchSize: number) {
    return this.doListOperationsAfterCursor(cursor, batchSize);
  }

  listProjectionPostingRowsForOperations(operations: ProjectionOperationRow[]) {
    return this.doListProjectionPostingRowsForOperations(operations);
  }

  applyProjectedDelta(
    input: ProjectedBalanceDelta & {
      operationId: string;
      sourceType: string;
      sourceId: string;
      operationCode: string;
      postedAt: Date;
    },
  ) {
    return this.doApplyProjectedDelta(input);
  }

  advanceCursor(input: { postedAt: Date; operationId: string }) {
    return this.doAdvanceCursor(input);
  }

  private async doEnsureCursor() {
    await this.tx
      .insert(schema.balanceProjectorCursors)
      .values({ workerKey: BALANCE_PROJECTOR_WORKER_KEY })
      .onConflictDoNothing();

    const [cursor] = await this.tx
      .select({
        workerKey: schema.balanceProjectorCursors.workerKey,
        lastPostedAt: schema.balanceProjectorCursors.lastPostedAt,
        lastOperationId: schema.balanceProjectorCursors.lastOperationId,
      })
      .from(schema.balanceProjectorCursors)
      .where(
        eq(
          schema.balanceProjectorCursors.workerKey,
          BALANCE_PROJECTOR_WORKER_KEY,
        ),
      )
      .limit(1)
      .for("update");

    if (!cursor) {
      throw new Error("Balance projector cursor initialization failed");
    }

    if (!hasConsistentCursor(cursor)) {
      await this.tx
        .update(schema.balanceProjectorCursors)
        .set({
          lastPostedAt: null,
          lastOperationId: null,
          updatedAt: sql`now()`,
        })
        .where(
          eq(
            schema.balanceProjectorCursors.workerKey,
            BALANCE_PROJECTOR_WORKER_KEY,
          ),
        );

      return {
        workerKey: cursor.workerKey,
        lastPostedAt: null,
        lastOperationId: null,
      };
    }

    return cursor;
  }

  private async doListOperationsAfterCursor(
    cursor: BalanceProjectorCursor,
    batchSize: number,
  ) {
    const rows =
      cursor.lastPostedAt === null || cursor.lastOperationId === null
        ? await this.tx.execute(sql`
            SELECT
              lo.id,
              lo.source_type,
              lo.source_id,
              lo.operation_code,
              lo.posted_at
            FROM ${schema.ledgerOperations} lo
            WHERE lo.status = 'posted'
              AND lo.posted_at IS NOT NULL
            ORDER BY lo.posted_at ASC, lo.id ASC
            LIMIT ${batchSize}
          `)
        : await this.tx.execute(sql`
            SELECT
              lo.id,
              lo.source_type,
              lo.source_id,
              lo.operation_code,
              lo.posted_at
            FROM ${schema.ledgerOperations} lo
            WHERE lo.status = 'posted'
              AND lo.posted_at IS NOT NULL
              AND (
                lo.posted_at > ${cursor.lastPostedAt}
                OR (
                  lo.posted_at = ${cursor.lastPostedAt}
                  AND lo.id > ${cursor.lastOperationId}
                )
              )
            ORDER BY lo.posted_at ASC, lo.id ASC
            LIMIT ${batchSize}
          `);

    return (
      (rows.rows ?? []) as {
        id: string;
        source_type: string;
        source_id: string;
        operation_code: string;
        posted_at: Date | string;
      }[]
    ).map((row) => ({
      id: row.id,
      sourceType: row.source_type,
      sourceId: row.source_id,
      operationCode: row.operation_code,
      postedAt:
        row.posted_at instanceof Date ? row.posted_at : new Date(row.posted_at),
    }));
  }

  private async doListProjectionPostingRowsForOperations(
    operations: ProjectionOperationRow[],
  ) {
    if (operations.length === 0) {
      return new Map();
    }

    const operationById = new Map(
      operations.map((operation) => [operation.id, operation]),
    );
    const rows = await this.tx.execute(sql`
      SELECT
        p.operation_id,
        p.line_no,
        p.book_id,
        p.currency,
        p.amount_minor,
        p.posting_code,
        debit_inst.dimensions AS debit_dimensions,
        credit_inst.dimensions AS credit_dimensions
      FROM ${schema.postings} p
      INNER JOIN ${schema.bookAccountInstances} debit_inst
        ON debit_inst.id = p.debit_instance_id
      INNER JOIN ${schema.bookAccountInstances} credit_inst
        ON credit_inst.id = p.credit_instance_id
      WHERE p.operation_id IN (${sql.join(
        operations.map((operation) => sql`${operation.id}::uuid`),
        sql`, `,
      )})
      ORDER BY p.operation_id ASC, p.line_no ASC
    `);

    const postingRowsByOperationId = new Map<string, ProjectionPostingRow[]>();

    for (const row of (rows.rows ?? []) as {
      operation_id: string;
      line_no: number;
      book_id: string;
      currency: string;
      amount_minor: string | bigint;
      posting_code: string;
      debit_dimensions: ProjectionPostingRow["debitDimensions"];
      credit_dimensions: ProjectionPostingRow["creditDimensions"];
    }[]) {
      const operation = operationById.get(row.operation_id);

      if (!operation) {
        continue;
      }

      const postingRow = {
        operationId: row.operation_id,
        sourceType: operation.sourceType,
        sourceId: operation.sourceId,
        operationCode: operation.operationCode,
        lineNo: row.line_no,
        bookId: row.book_id,
        currency: row.currency,
        amountMinor:
          typeof row.amount_minor === "bigint"
            ? row.amount_minor
            : BigInt(row.amount_minor),
        postingCode: row.posting_code,
        debitDimensions: row.debit_dimensions,
        creditDimensions: row.credit_dimensions,
      };
      const bucket = postingRowsByOperationId.get(row.operation_id) ?? [];
      bucket.push(postingRow);
      postingRowsByOperationId.set(row.operation_id, bucket);
    }

    return postingRowsByOperationId;
  }

  private async doApplyProjectedDelta(
    input: ProjectedBalanceDelta & {
      operationId: string;
      sourceType: string;
      sourceId: string;
      operationCode: string;
      postedAt: Date;
    },
  ) {
    await this.tx
      .insert(schema.balancePositions)
      .values({
        bookId: input.bookId,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        currency: input.currency,
      })
      .onConflictDoNothing();

    const inserted = await this.tx
      .insert(schema.balanceEvents)
      .values({
        bookId: input.bookId,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        currency: input.currency,
        eventType: BALANCE_EVENT_TYPE,
        operationId: input.operationId,
        deltaLedgerBalance: input.deltaLedgerBalance,
        deltaAvailable: input.deltaAvailable,
        meta: {
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          operationCode: input.operationCode,
          postedAt: input.postedAt.toISOString(),
        },
      })
      .onConflictDoNothing()
      .returning({ id: schema.balanceEvents.id });

    if (!inserted[0]) {
      return false;
    }

    await this.tx
      .update(schema.balancePositions)
      .set({
        ledgerBalance: sql`${schema.balancePositions.ledgerBalance} + ${input.deltaLedgerBalance}`,
        available: sql`${schema.balancePositions.available} + ${input.deltaAvailable}`,
        updatedAt: sql`now()`,
        version: sql`${schema.balancePositions.version} + 1`,
      })
      .where(
        and(
          eq(schema.balancePositions.bookId, input.bookId),
          eq(schema.balancePositions.subjectType, input.subjectType),
          eq(schema.balancePositions.subjectId, input.subjectId),
          eq(schema.balancePositions.currency, input.currency),
        ),
      );

    return true;
  }

  private async doAdvanceCursor(input: {
    postedAt: Date;
    operationId: string;
  }) {
    await this.tx
      .update(schema.balanceProjectorCursors)
      .set({
        lastPostedAt: input.postedAt,
        lastOperationId: input.operationId,
        updatedAt: sql`now()`,
      })
      .where(
        eq(
          schema.balanceProjectorCursors.workerKey,
          BALANCE_PROJECTOR_WORKER_KEY,
        ),
      );
  }
}
