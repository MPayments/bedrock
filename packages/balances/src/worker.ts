import { and, asc, eq, sql } from "drizzle-orm";

import type { Database, Transaction } from "@bedrock/db";
import { schema, type Dimensions } from "@bedrock/db/schema";
import { noopLogger, type Logger } from "@bedrock/kernel";

const BALANCE_PROJECTOR_WORKER_KEY = "ledger_posted";
const BALANCE_EVENT_TYPE = "ledger_posted";

interface CursorRow {
  workerKey: string;
  lastPostedAt: Date | null;
  lastOperationId: string | null;
}

interface OperationRow {
  id: string;
  sourceType: string;
  sourceId: string;
  operationCode: string;
  postedAt: Date;
}

interface ProjectionPostingRow {
  operationId: string;
  sourceType: string;
  sourceId: string;
  operationCode: string;
  lineNo: number;
  bookId: string;
  currency: string;
  amountMinor: bigint;
  postingCode: string;
  debitDimensions: Dimensions | null;
  creditDimensions: Dimensions | null;
}

export interface ProjectedBalanceDelta {
  bookId: string;
  subjectType: string;
  subjectId: string;
  currency: string;
  deltaLedgerBalance: bigint;
  deltaAvailable: bigint;
}

function camelToSnake(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[-\s]+/g, "_")
    .toLowerCase();
}

export function projectBalanceSubjects(
  dimensions: Dimensions | null | undefined,
): { subjectType: string; subjectId: string }[] {
  if (!dimensions) {
    return [];
  }

  const subjects: { subjectType: string; subjectId: string }[] = [];
  for (const [key, value] of Object.entries(dimensions)) {
    if (!key.endsWith("Id") || typeof value !== "string" || value.length === 0) {
      continue;
    }

    subjects.push({
      subjectType: camelToSnake(key.slice(0, -2)),
      subjectId: value,
    });
  }

  return subjects;
}

export function buildProjectedBalanceDeltas(
  rows: ProjectionPostingRow[],
): ProjectedBalanceDelta[] {
  const aggregated = new Map<string, ProjectedBalanceDelta>();

  const applyDelta = (
    bookId: string,
    currency: string,
    subjectType: string,
    subjectId: string,
    amount: bigint,
  ) => {
    const key = `${bookId}:${currency}:${subjectType}:${subjectId}`;
    const existing = aggregated.get(key);
    if (existing) {
      existing.deltaLedgerBalance += amount;
      existing.deltaAvailable += amount;
      return;
    }

    aggregated.set(key, {
      bookId,
      currency,
      subjectType,
      subjectId,
      deltaLedgerBalance: amount,
      deltaAvailable: amount,
    });
  };

  for (const row of rows) {
    for (const subject of projectBalanceSubjects(row.debitDimensions)) {
      applyDelta(
        row.bookId,
        row.currency,
        subject.subjectType,
        subject.subjectId,
        row.amountMinor,
      );
    }

    for (const subject of projectBalanceSubjects(row.creditDimensions)) {
      applyDelta(
        row.bookId,
        row.currency,
        subject.subjectType,
        subject.subjectId,
        -row.amountMinor,
      );
    }
  }

  return Array.from(aggregated.values()).filter(
    (delta) => delta.deltaLedgerBalance !== 0n || delta.deltaAvailable !== 0n,
  );
}

async function ensureCursorTx(tx: Transaction): Promise<CursorRow> {
  await tx
    .insert(schema.balanceProjectorCursors)
    .values({ workerKey: BALANCE_PROJECTOR_WORKER_KEY })
    .onConflictDoNothing();

  const [cursor] = await tx
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

  return cursor;
}

async function ensureBalancePositionTx(
  tx: Transaction,
  input: {
    bookId: string;
    subjectType: string;
    subjectId: string;
    currency: string;
  },
) {
  await tx
    .insert(schema.balancePositions)
    .values(input)
    .onConflictDoNothing();
}

async function applyProjectedDeltaTx(
  tx: Transaction,
  input: ProjectedBalanceDelta & {
    operationId: string;
    sourceType: string;
    sourceId: string;
    operationCode: string;
    postedAt: Date;
  },
) {
  await ensureBalancePositionTx(tx, input);

  const inserted = await tx
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

  await tx
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

async function listOperationsAfterCursorTx(
  tx: Transaction,
  cursor: CursorRow,
  batchSize: number,
): Promise<OperationRow[]> {
  const rows = await tx.execute(sql`
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
        ${cursor.lastPostedAt} IS NULL
        OR lo.posted_at > ${cursor.lastPostedAt}
        OR (
          lo.posted_at = ${cursor.lastPostedAt}
          AND ${cursor.lastOperationId} IS NOT NULL
          AND lo.id > ${cursor.lastOperationId}
        )
      )
    ORDER BY lo.posted_at ASC, lo.id ASC
    LIMIT ${batchSize}
  `);

  return ((rows.rows ?? []) as {
    id: string;
    source_type: string;
    source_id: string;
    operation_code: string;
    posted_at: Date | string;
  }[]).map((row) => ({
    id: row.id,
    sourceType: row.source_type,
    sourceId: row.source_id,
    operationCode: row.operation_code,
    postedAt:
      row.posted_at instanceof Date ? row.posted_at : new Date(row.posted_at),
  }));
}

async function listProjectionPostingRowsTx(
  tx: Transaction,
  operation: OperationRow,
): Promise<ProjectionPostingRow[]> {
  const rows = await tx.execute(sql`
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
    WHERE p.operation_id = ${operation.id}
    ORDER BY p.line_no ASC
  `);

  return ((rows.rows ?? []) as {
    operation_id: string;
    line_no: number;
    book_id: string;
    currency: string;
    amount_minor: string | bigint;
    posting_code: string;
    debit_dimensions: Dimensions | null;
    credit_dimensions: Dimensions | null;
  }[]).map((row) => ({
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
  }));
}

export function createBalancesProjectorWorker(deps: {
  db: Database;
  logger?: Logger;
}) {
  const db = deps.db;
  const log = deps.logger?.child({ svc: "balances-projector" }) ?? noopLogger;

  async function processOnce(opts?: { batchSize?: number }) {
    const batchSize = opts?.batchSize ?? 100;

    return db.transaction(async (tx) => {
      const cursor = await ensureCursorTx(tx);
      const operations = await listOperationsAfterCursorTx(tx, cursor, batchSize);
      let processed = 0;

      for (const operation of operations) {
        const postingRows = await listProjectionPostingRowsTx(tx, operation);
        const deltas = buildProjectedBalanceDeltas(postingRows);

        for (const delta of deltas) {
          await applyProjectedDeltaTx(tx, {
            ...delta,
            operationId: operation.id,
            sourceType: operation.sourceType,
            sourceId: operation.sourceId,
            operationCode: operation.operationCode,
            postedAt: operation.postedAt,
          });
        }

        await tx
          .update(schema.balanceProjectorCursors)
          .set({
            lastPostedAt: operation.postedAt,
            lastOperationId: operation.id,
            updatedAt: sql`now()`,
          })
          .where(
            eq(
              schema.balanceProjectorCursors.workerKey,
              BALANCE_PROJECTOR_WORKER_KEY,
            ),
          );

        processed += 1;
      }

      if (processed > 0) {
        log.info("Projected ledger operations into balances", {
          processed,
          lastOperationId: operations[operations.length - 1]?.id ?? null,
        });
      }

      return processed;
    });
  }

  return {
    processOnce,
  };
}
