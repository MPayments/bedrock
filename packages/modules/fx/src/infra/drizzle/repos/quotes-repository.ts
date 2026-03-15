import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  sql,
} from "drizzle-orm";

import { type Database } from "@bedrock/platform/persistence/drizzle";

import type {
  FxDbExecutor,
  FxQuoteLegRecord,
  FxQuoteLegWriteModel,
  FxQuoteRecord,
  FxQuotesRepositoryPort,
  FxQuoteWriteModel,
} from "../../../application/ports";
import { schema } from "../schema";

export function createDrizzleFxQuotesRepository(
  db: Database,
): FxQuotesRepositoryPort {
  function executorOrDb(executor?: FxDbExecutor) {
    return executor ?? db;
  }

  async function insertQuote(
    input: FxQuoteWriteModel,
    executor?: FxDbExecutor,
  ): Promise<FxQuoteRecord | null> {
    const inserted = await executorOrDb(executor)
      .insert(schema.fxQuotes)
      .values(input)
      .onConflictDoNothing({
        target: schema.fxQuotes.idempotencyKey,
      })
      .returning();

    return (inserted[0] as FxQuoteRecord | undefined) ?? null;
  }

  async function insertQuoteLegs(
    input: FxQuoteLegWriteModel[],
    executor?: FxDbExecutor,
  ): Promise<void> {
    if (input.length === 0) {
      return;
    }

    await executorOrDb(executor).insert(schema.fxQuoteLegs).values(input);
  }

  async function listQuotes(input: {
    limit: number;
    offset: number;
    sortBy: string;
    sortOrder: "asc" | "desc";
    idempotencyKey?: string;
    status?: string[];
    pricingMode?: string[];
  }): Promise<{ rows: FxQuoteRecord[]; total: number }> {
    const conditions = [];

    if (input.idempotencyKey) {
      conditions.push(
        ilike(schema.fxQuotes.idempotencyKey, `%${input.idempotencyKey}%`),
      );
    }

    if (input.status && input.status.length > 0) {
      conditions.push(inArray(schema.fxQuotes.status, input.status as any));
    }

    if (input.pricingMode && input.pricingMode.length > 0) {
      conditions.push(
        inArray(schema.fxQuotes.pricingMode, input.pricingMode as any),
      );
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const sortColumn =
      input.sortBy === "expiresAt"
        ? schema.fxQuotes.expiresAt
        : input.sortBy === "usedAt"
          ? schema.fxQuotes.usedAt
          : input.sortBy === "status"
            ? schema.fxQuotes.status
            : input.sortBy === "pricingMode"
              ? schema.fxQuotes.pricingMode
              : schema.fxQuotes.createdAt;
    const sortDirection =
      input.sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn);

    const [rows, totalRows] = await Promise.all([
      db
        .select()
        .from(schema.fxQuotes)
        .where(where)
        .orderBy(sortDirection, desc(schema.fxQuotes.createdAt))
        .limit(input.limit)
        .offset(input.offset),
      db
        .select({ total: sql<number>`count(*)::int` })
        .from(schema.fxQuotes)
        .where(where),
    ]);

    return {
      rows: rows as FxQuoteRecord[],
      total: totalRows[0]?.total ?? 0,
    };
  }

  async function findQuoteById(
    id: string,
    executor?: FxDbExecutor,
  ): Promise<FxQuoteRecord | undefined> {
    const [quote] = await executorOrDb(executor)
      .select()
      .from(schema.fxQuotes)
      .where(eq(schema.fxQuotes.id, id))
      .limit(1);

    return quote as FxQuoteRecord | undefined;
  }

  async function findQuoteByIdempotencyKey(
    idempotencyKey: string,
    executor?: FxDbExecutor,
  ): Promise<FxQuoteRecord | undefined> {
    const [quote] = await executorOrDb(executor)
      .select()
      .from(schema.fxQuotes)
      .where(eq(schema.fxQuotes.idempotencyKey, idempotencyKey))
      .limit(1);

    return quote as FxQuoteRecord | undefined;
  }

  async function listQuoteLegs(
    quoteId: string,
    executor?: FxDbExecutor,
  ): Promise<FxQuoteLegRecord[]> {
    const legs = await executorOrDb(executor)
      .select()
      .from(schema.fxQuoteLegs)
      .where(eq(schema.fxQuoteLegs.quoteId, quoteId))
      .orderBy(schema.fxQuoteLegs.idx);

    return legs as FxQuoteLegRecord[];
  }

  async function markQuoteUsedIfActive(input: {
    quoteId: string;
    usedByRef: string;
    at: Date;
  }): Promise<FxQuoteRecord | undefined> {
    const updated = await db
      .update(schema.fxQuotes)
      .set({
        status: "used",
        usedByRef: input.usedByRef,
        usedAt: input.at,
      })
      .where(
        and(
          eq(schema.fxQuotes.id, input.quoteId),
          eq(schema.fxQuotes.status, "active"),
        ),
      )
      .returning();

    return updated[0] as FxQuoteRecord | undefined;
  }

  async function expireOldQuotes(now: Date): Promise<void> {
    await db.execute(sql`
      UPDATE ${schema.fxQuotes}
      SET status = 'expired'
      WHERE status = 'active'
        AND expires_at <= ${now}
    `);
  }

  return {
    insertQuote,
    insertQuoteLegs,
    listQuotes,
    findQuoteById,
    findQuoteByIdempotencyKey,
    listQuoteLegs,
    markQuoteUsedIfActive,
    expireOldQuotes,
  };
}
