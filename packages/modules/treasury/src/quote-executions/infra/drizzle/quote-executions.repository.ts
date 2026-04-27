import { and, desc, eq, sql, type SQL } from "drizzle-orm";

import type { Queryable, Transaction } from "@bedrock/platform/persistence";
import type { PersistenceSession } from "@bedrock/shared/core/persistence";

import { quoteExecutions } from "./schema";
import type {
  QuoteExecutionsListQuery,
  QuoteExecutionsRepository,
} from "../../application/ports/quote-executions.repository";
import type {
  QuoteExecutionRecord,
  QuoteExecutionParties,
} from "../../domain/types";

type QuoteExecutionRow = typeof quoteExecutions.$inferSelect;
type QuoteExecutionInsertRow = typeof quoteExecutions.$inferInsert;

type TransactionalQueryable = Queryable & {
  transaction: <TResult>(
    callback: (tx: Transaction) => Promise<TResult>,
  ) => Promise<TResult>;
};

function hasTransaction(db: Queryable): db is TransactionalQueryable {
  return typeof (db as { transaction?: unknown }).transaction === "function";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPartyRef(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    (typeof value.requisiteId === "string" || value.requisiteId === null)
  );
}

function extractParties(quoteSnapshot: unknown): QuoteExecutionParties | null {
  if (!isRecord(quoteSnapshot)) return null;
  const parties = isRecord(quoteSnapshot.executionParties);
  if (!isRecord(parties)) return null;
  if (!isPartyRef(parties.creditParty) || !isPartyRef(parties.debitParty)) {
    return null;
  }
  return parties as unknown as QuoteExecutionParties;
}

function attachPartiesToSnapshot(
  quoteSnapshot: unknown,
  executionParties: QuoteExecutionParties | null,
): unknown {
  if (!executionParties) return quoteSnapshot;
  if (isRecord(quoteSnapshot)) {
    return {
      ...quoteSnapshot,
      executionParties,
    };
  }
  return { quoteSnapshot, executionParties };
}

function toRecord(row: QuoteExecutionRow): QuoteExecutionRecord {
  return {
    completedAt: row.completedAt,
    createdAt: row.createdAt,
    dealId: row.dealId,
    failureReason: row.failureReason,
    fromAmountMinor: row.fromAmountMinor,
    fromCurrencyId: row.fromCurrencyId,
    id: row.id,
    origin: row.origin,
    postingDocumentRefs: row.postingDocumentRefs,
    providerRef: row.providerRef,
    providerSnapshot: row.providerSnapshot,
    quoteId: row.quoteId,
    quoteLegIdx: row.quoteLegIdx,
    quoteSnapshot: row.quoteSnapshot,
    rateDen: row.rateDen,
    rateNum: row.rateNum,
    executionParties: extractParties(row.quoteSnapshot),
    sourceRef: row.sourceRef,
    state: row.state,
    submittedAt: row.submittedAt,
    toAmountMinor: row.toAmountMinor,
    toCurrencyId: row.toCurrencyId,
    treasuryOrderId: row.treasuryOrderId,
    updatedAt: row.updatedAt,
  };
}

function toInsertRow(record: QuoteExecutionRecord): QuoteExecutionInsertRow {
  return {
    completedAt: record.completedAt,
    createdAt: record.createdAt,
    dealId: record.dealId,
    failureReason: record.failureReason,
    fromAmountMinor: record.fromAmountMinor,
    fromCurrencyId: record.fromCurrencyId,
    id: record.id,
    origin: record.origin,
    postingDocumentRefs: record.postingDocumentRefs,
    providerRef: record.providerRef,
    providerSnapshot: record.providerSnapshot,
    quoteId: record.quoteId,
    quoteLegIdx: record.quoteLegIdx,
    quoteSnapshot: attachPartiesToSnapshot(
      record.quoteSnapshot,
      record.executionParties,
    ),
    rateDen: record.rateDen,
    rateNum: record.rateNum,
    sourceRef: record.sourceRef,
    state: record.state,
    submittedAt: record.submittedAt,
    toAmountMinor: record.toAmountMinor,
    toCurrencyId: record.toCurrencyId,
    treasuryOrderId: record.treasuryOrderId,
    updatedAt: record.updatedAt,
  };
}

export class DrizzleQuoteExecutionsRepository implements QuoteExecutionsRepository {
  constructor(private readonly db: Queryable) {}

  async findById(
    id: string,
    tx?: PersistenceSession,
  ): Promise<QuoteExecutionRecord | undefined> {
    const database = (tx as Transaction | undefined) ?? this.db;
    const [row] = await database
      .select()
      .from(quoteExecutions)
      .where(eq(quoteExecutions.id, id))
      .limit(1);
    return row ? toRecord(row) : undefined;
  }

  async insert(
    input: QuoteExecutionRecord,
    tx?: PersistenceSession,
  ): Promise<QuoteExecutionRecord | null> {
    return this.runWrite(tx, async (database) => {
      const inserted = await database
        .insert(quoteExecutions)
        .values(toInsertRow(input))
        .onConflictDoNothing()
        .returning({ id: quoteExecutions.id });
      if (!inserted.length) return null;

      return (await this.findById(input.id, database)) ?? null;
    });
  }

  async list(
    input: QuoteExecutionsListQuery,
    tx?: PersistenceSession,
  ): Promise<{ rows: QuoteExecutionRecord[]; total: number }> {
    const database = (tx as Transaction | undefined) ?? this.db;
    const conditions: SQL[] = [];
    if (input.dealId) conditions.push(eq(quoteExecutions.dealId, input.dealId));
    if (input.quoteId)
      conditions.push(eq(quoteExecutions.quoteId, input.quoteId));
    if (input.state) conditions.push(eq(quoteExecutions.state, input.state));
    if (input.treasuryOrderId) {
      conditions.push(
        eq(quoteExecutions.treasuryOrderId, input.treasuryOrderId),
      );
    }
    const where = conditions.length ? and(...conditions) : undefined;

    const [rows, countRows] = await Promise.all([
      database
        .select()
        .from(quoteExecutions)
        .where(where)
        .orderBy(desc(quoteExecutions.createdAt))
        .limit(input.limit)
        .offset(input.offset),
      database
        .select({ total: sql<number>`count(*)::int` })
        .from(quoteExecutions)
        .where(where),
    ]);

    return {
      rows: rows.map(toRecord),
      total: countRows[0]?.total ?? 0,
    };
  }

  async update(
    input: QuoteExecutionRecord,
    tx?: PersistenceSession,
  ): Promise<QuoteExecutionRecord | undefined> {
    return this.runWrite(tx, async (database) => {
      const [updated] = await database
        .update(quoteExecutions)
        .set(toInsertRow(input))
        .where(eq(quoteExecutions.id, input.id))
        .returning({ id: quoteExecutions.id });
      if (!updated) return undefined;

      return this.findById(input.id, database);
    });
  }

  private async runWrite<TResult>(
    tx: PersistenceSession | undefined,
    work: (database: Queryable) => Promise<TResult>,
  ): Promise<TResult> {
    if (tx) return work(tx as Transaction);
    if (hasTransaction(this.db)) {
      return this.db.transaction((database) => work(database));
    }
    return work(this.db);
  }
}
