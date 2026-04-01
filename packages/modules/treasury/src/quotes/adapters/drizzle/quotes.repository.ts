import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  sql,
} from "drizzle-orm";

import type { Queryable, Transaction } from "@bedrock/platform/persistence";
import type { PersistenceSession } from "@bedrock/shared/core/persistence";

import { schema } from "../../../schema";
import type {
  MarkQuoteUsedInput,
  QuoteLegRecord,
  QuoteLegWriteModel,
  QuoteRecord,
  QuotesListQuery,
  QuotesRepository,
  QuoteWriteModel,
} from "../../application/ports";

export class DrizzleTreasuryQuotesRepository implements QuotesRepository {
  constructor(private readonly db: Queryable) {}

  async insertQuote(
    input: QuoteWriteModel,
    tx?: PersistenceSession,
  ): Promise<QuoteRecord | null> {
    const database = (tx as Transaction | undefined) ?? this.db;
    const inserted = await database
      .insert(schema.fxQuotes)
      .values({
        ...input,
        pricingTrace: input.pricingTrace ?? undefined,
      })
      .onConflictDoNothing({
        target: schema.fxQuotes.idempotencyKey,
      })
      .returning();

    return (inserted[0] as QuoteRecord | undefined) ?? null;
  }

  async insertQuoteLegs(
    input: QuoteLegWriteModel[],
    tx?: PersistenceSession,
  ): Promise<void> {
    if (input.length === 0) {
      return;
    }

    const database = (tx as Transaction | undefined) ?? this.db;
    await database.insert(schema.fxQuoteLegs).values(input);
  }

  async listQuotes(
    input: QuotesListQuery,
  ): Promise<{ rows: QuoteRecord[]; total: number }> {
    const conditions = [];

    if (input.idempotencyKey) {
      conditions.push(
        ilike(schema.fxQuotes.idempotencyKey, `%${input.idempotencyKey}%`),
      );
    }

    if (input.dealId) {
      conditions.push(eq(schema.fxQuotes.dealId, input.dealId));
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
      this.db
        .select()
        .from(schema.fxQuotes)
        .where(where)
        .orderBy(sortDirection, desc(schema.fxQuotes.createdAt))
        .limit(input.limit)
        .offset(input.offset),
      this.db
        .select({ total: sql<number>`count(*)::int` })
        .from(schema.fxQuotes)
        .where(where),
    ]);

    return {
      rows: rows as QuoteRecord[],
      total: totalRows[0]?.total ?? 0,
    };
  }

  async findQuoteById(
    id: string,
    tx?: PersistenceSession,
  ): Promise<QuoteRecord | undefined> {
    const database = (tx as Transaction | undefined) ?? this.db;
    const [quote] = await database
      .select()
      .from(schema.fxQuotes)
      .where(eq(schema.fxQuotes.id, id))
      .limit(1);

    return quote as QuoteRecord | undefined;
  }

  async findQuoteByIdempotencyKey(
    idempotencyKey: string,
    tx?: PersistenceSession,
  ): Promise<QuoteRecord | undefined> {
    const database = (tx as Transaction | undefined) ?? this.db;
    const [quote] = await database
      .select()
      .from(schema.fxQuotes)
      .where(eq(schema.fxQuotes.idempotencyKey, idempotencyKey))
      .limit(1);

    return quote as QuoteRecord | undefined;
  }

  async listQuoteLegs(
    quoteId: string,
    tx?: PersistenceSession,
  ): Promise<QuoteLegRecord[]> {
    const database = (tx as Transaction | undefined) ?? this.db;
    const legs = await database
      .select()
      .from(schema.fxQuoteLegs)
      .where(eq(schema.fxQuoteLegs.quoteId, quoteId))
      .orderBy(schema.fxQuoteLegs.idx);

    return legs as QuoteLegRecord[];
  }

  async markQuoteUsedIfActive(
    input: MarkQuoteUsedInput,
  ): Promise<QuoteRecord | undefined> {
    const updated = await this.db
      .update(schema.fxQuotes)
      .set({
        ...(input.dealId ? { dealId: input.dealId } : {}),
        status: "used",
        usedByRef: input.usedByRef,
        ...(input.usedDocumentId
          ? { usedDocumentId: input.usedDocumentId }
          : {}),
        usedAt: input.at,
      })
      .where(
        and(
          eq(schema.fxQuotes.id, input.quoteId),
          eq(schema.fxQuotes.status, "active"),
        ),
      )
      .returning();

    return updated[0] as QuoteRecord | undefined;
  }

  async expireOldQuotes(now: Date): Promise<QuoteRecord[]> {
    const expired = await this.db
      .update(schema.fxQuotes)
      .set({
        status: "expired",
      })
      .where(
        and(
          eq(schema.fxQuotes.status, "active"),
          sql`${schema.fxQuotes.expiresAt} <= ${now}`,
        ),
      )
      .returning();

    return expired as QuoteRecord[];
  }
}
