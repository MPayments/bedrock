import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";

import { type Database } from "@bedrock/platform/persistence/drizzle";

import type {
  FxRateSource,
  FxRateSourceRowRecord,
  RateHistoryPoint,
  RatePairView,
  RateRowRecord,
  SourceRateView,
  FxRatesRepository,
} from "../../../application/rates/ports";
import { getSourceOrder } from "../../../domain/source-priority";
import { schema as fxSchema } from "../schema";

function computeRate(num: bigint, den: bigint): number {
  return Number(num) / Number(den);
}

export function createDrizzleFxRatesRepository(
  db: Database,
): FxRatesRepository {
  async function getSourceRow(
    source: FxRateSource,
  ): Promise<FxRateSourceRowRecord | null> {
    const [row] = await db
      .select()
      .from(fxSchema.fxRateSources)
      .where(eq(fxSchema.fxRateSources.source, source))
      .limit(1);

    return (row as FxRateSourceRowRecord | undefined) ?? null;
  }

  async function initializeSourceRow(
    source: FxRateSource,
    ttlSeconds: number,
  ): Promise<FxRateSourceRowRecord | null> {
    const [inserted] = await db
      .insert(fxSchema.fxRateSources)
      .values({
        source,
        ttlSeconds,
        lastStatus: "idle",
      })
      .onConflictDoNothing({
        target: fxSchema.fxRateSources.source,
      })
      .returning();

    if (inserted) {
      return inserted as FxRateSourceRowRecord;
    }

    return getSourceRow(source);
  }

  async function listSourceRows(
    sources: FxRateSource[],
  ): Promise<FxRateSourceRowRecord[]> {
    if (sources.length === 0) {
      return [];
    }

    const rows = await db
      .select()
      .from(fxSchema.fxRateSources)
      .where(inArray(fxSchema.fxRateSources.source, sources))
      .orderBy(fxSchema.fxRateSources.source);

    return rows as FxRateSourceRowRecord[];
  }

  async function listSourceRateRows(
    source: FxRateSource,
    baseCurrencyId: string,
    quoteCurrencyId: string,
  ): Promise<RateRowRecord[]> {
    const rows = await db
      .select()
      .from(fxSchema.fxRates)
      .where(
        and(
          eq(fxSchema.fxRates.source, source),
          eq(fxSchema.fxRates.baseCurrencyId, baseCurrencyId),
          eq(fxSchema.fxRates.quoteCurrencyId, quoteCurrencyId),
        ),
      )
      .orderBy(desc(fxSchema.fxRates.asOf), desc(fxSchema.fxRates.createdAt));

    return rows as RateRowRecord[];
  }

  async function listManualRateRows(
    baseCurrencyId: string,
    quoteCurrencyId: string,
  ): Promise<RateRowRecord[]> {
    const rows = await db
      .select()
      .from(fxSchema.fxRates)
      .where(
        and(
          ne(fxSchema.fxRates.source, "cbr"),
          ne(fxSchema.fxRates.source, "investing"),
          ne(fxSchema.fxRates.source, "xe"),
          eq(fxSchema.fxRates.baseCurrencyId, baseCurrencyId),
          eq(fxSchema.fxRates.quoteCurrencyId, quoteCurrencyId),
        ),
      )
      .orderBy(desc(fxSchema.fxRates.asOf), desc(fxSchema.fxRates.createdAt));

    return rows as RateRowRecord[];
  }

  async function upsertSourceRates(
    source: FxRateSource,
    rates: {
      baseCurrencyId: string;
      quoteCurrencyId: string;
      rateNum: bigint;
      rateDen: bigint;
      asOf: Date;
    }[],
  ): Promise<void> {
    if (rates.length === 0) {
      return;
    }

    await db
      .insert(fxSchema.fxRates)
      .values(
        rates.map((rate) => ({
          source,
          baseCurrencyId: rate.baseCurrencyId,
          quoteCurrencyId: rate.quoteCurrencyId,
          rateNum: rate.rateNum,
          rateDen: rate.rateDen,
          asOf: rate.asOf,
        })),
      )
      .onConflictDoUpdate({
        target: [
          fxSchema.fxRates.source,
          fxSchema.fxRates.baseCurrencyId,
          fxSchema.fxRates.quoteCurrencyId,
          fxSchema.fxRates.asOf,
        ],
        set: {
          rateNum: sql`excluded.rate_num`,
          rateDen: sql`excluded.rate_den`,
        },
      });
  }

  async function upsertSourceSuccess(input: {
    source: FxRateSource;
    ttlSeconds: number;
    lastSyncedAt: Date;
    lastPublishedAt: Date;
    updatedAt: Date;
  }): Promise<void> {
    await db
      .insert(fxSchema.fxRateSources)
      .values({
        source: input.source,
        ttlSeconds: input.ttlSeconds,
        lastSyncedAt: input.lastSyncedAt,
        lastPublishedAt: input.lastPublishedAt,
        lastStatus: "ok",
        lastError: null,
        updatedAt: input.updatedAt,
      })
      .onConflictDoUpdate({
        target: fxSchema.fxRateSources.source,
        set: {
          ttlSeconds: input.ttlSeconds,
          lastSyncedAt: input.lastSyncedAt,
          lastPublishedAt: input.lastPublishedAt,
          lastStatus: "ok",
          lastError: null,
          updatedAt: input.updatedAt,
        },
      });
  }

  async function upsertSourceFailure(input: {
    source: FxRateSource;
    ttlSeconds: number;
    lastError: string;
    updatedAt: Date;
  }): Promise<void> {
    await db
      .insert(fxSchema.fxRateSources)
      .values({
        source: input.source,
        ttlSeconds: input.ttlSeconds,
        lastStatus: "error",
        lastError: input.lastError,
        updatedAt: input.updatedAt,
      })
      .onConflictDoUpdate({
        target: fxSchema.fxRateSources.source,
        set: {
          lastStatus: "error",
          lastError: input.lastError,
          updatedAt: input.updatedAt,
        },
      });
  }

  async function insertManualRate(input: {
    baseCurrencyId: string;
    quoteCurrencyId: string;
    rateNum: bigint;
    rateDen: bigint;
    asOf: Date;
    source: string;
  }): Promise<void> {
    await db.insert(fxSchema.fxRates).values(input);
  }

  async function listPairs(): Promise<RatePairView[]> {
    const fr = fxSchema.fxRates;

    const rows = await db.execute<{
      source: string;
      rate_num: string;
      rate_den: string;
      as_of: string;
      base_code: string;
      quote_code: string;
      rn: string;
    }>(sql`
      WITH ranked AS (
        SELECT
          ${fr.source} AS source,
          ${fr.baseCurrencyId} AS base_currency_id,
          ${fr.quoteCurrencyId} AS quote_currency_id,
          ${fr.rateNum} AS rate_num,
          ${fr.rateDen} AS rate_den,
          ${fr.asOf} AS as_of,
          ROW_NUMBER() OVER (
            PARTITION BY ${fr.source}, ${fr.baseCurrencyId}, ${fr.quoteCurrencyId}
            ORDER BY ${fr.asOf} DESC, ${fr.createdAt} DESC
          ) AS rn
        FROM ${fr}
      )
      SELECT
        r.source,
        r.rate_num::text AS rate_num,
        r.rate_den::text AS rate_den,
        r.as_of,
        bc.code AS base_code,
        qc.code AS quote_code,
        r.rn::text AS rn
      FROM ranked r
      JOIN "currencies" bc ON bc.id = r.base_currency_id
      JOIN "currencies" qc ON qc.id = r.quote_currency_id
      WHERE r.rn <= 2
      ORDER BY base_code, quote_code, r.source, r.rn
    `);

    const grouped = new Map<
      string,
      Map<string, { current: (typeof rows.rows)[number]; previous?: (typeof rows.rows)[number] }>
    >();

    for (const row of rows.rows) {
      const pairKey = `${row.base_code}|${row.quote_code}`;
      if (!grouped.has(pairKey)) {
        grouped.set(pairKey, new Map());
      }

      const sourceMap = grouped.get(pairKey)!;
      const rn = Number(row.rn);

      if (!sourceMap.has(row.source)) {
        sourceMap.set(row.source, { current: row });
      }

      const entry = sourceMap.get(row.source)!;
      if (rn === 1) {
        entry.current = row;
      } else if (rn === 2) {
        entry.previous = row;
      }
    }

    const result: RatePairView[] = [];

    for (const [pairKey, sourceMap] of grouped) {
      const [baseCode, quoteCode] = pairKey.split("|");
      const rates: SourceRateView[] = [];
      const order = getSourceOrder(baseCode!, quoteCode!);

      for (const [, entry] of sourceMap) {
        const rateNum = BigInt(entry.current.rate_num);
        const rateDen = BigInt(entry.current.rate_den);
        const currentDecimal = computeRate(rateNum, rateDen);

        let change: number | null = null;
        let changePercent: number | null = null;

        if (entry.previous) {
          const prevDecimal = computeRate(
            BigInt(entry.previous.rate_num),
            BigInt(entry.previous.rate_den),
          );
          if (prevDecimal !== 0) {
            change = currentDecimal - prevDecimal;
            changePercent = (change / prevDecimal) * 100;
          }
        }

        rates.push({
          source: entry.current.source,
          rateNum,
          rateDen,
          asOf: new Date(entry.current.as_of),
          change,
          changePercent,
        });
      }

      for (const rate of rates) {
        if (rate.source === "manual") {
          continue;
        }

        if (!order.includes(rate.source as FxRateSource)) {
          throw new Error(`Unknown FX rate source: ${rate.source}`);
        }
      }

      rates.sort((left, right) => {
        if (left.source === "manual") return -1;
        if (right.source === "manual") return 1;
        return (
          order.indexOf(left.source as FxRateSource) -
          order.indexOf(right.source as FxRateSource)
        );
      });

      result.push({
        baseCurrencyCode: baseCode!,
        quoteCurrencyCode: quoteCode!,
        bestRate: rates[0]!,
        rates,
      });
    }

    result.sort((left, right) => {
      const cmp = left.baseCurrencyCode.localeCompare(right.baseCurrencyCode);
      return cmp !== 0
        ? cmp
        : left.quoteCurrencyCode.localeCompare(right.quoteCurrencyCode);
    });

    return result;
  }

  async function getRateHistory(input: {
    base: string;
    quote: string;
    limit?: number;
    from?: Date;
  }): Promise<RateHistoryPoint[]> {
    const fr = fxSchema.fxRates;

    const rows = await db.execute<{
      source: string;
      rate_num: string;
      rate_den: string;
      as_of: string;
    }>(sql`
      SELECT
        r.source,
        r.rate_num::text AS rate_num,
        r.rate_den::text AS rate_den,
        r.as_of
      FROM ${fr} r
      JOIN "currencies" bc ON bc.id = r.base_currency_id
      JOIN "currencies" qc ON qc.id = r.quote_currency_id
      WHERE bc.code = ${input.base.trim().toUpperCase()}
        AND qc.code = ${input.quote.trim().toUpperCase()}
        AND (${input.from ?? null}::timestamptz IS NULL OR r.as_of >= ${input.from ?? null}::timestamptz)
      ORDER BY r.as_of ASC
      LIMIT ${input.limit ?? 100}
    `);

    return rows.rows.map((row) => ({
      source: row.source,
      rateNum: BigInt(row.rate_num),
      rateDen: BigInt(row.rate_den),
      asOf: new Date(row.as_of),
    }));
  }

  return {
    getSourceRow,
    initializeSourceRow,
    listSourceRows,
    listSourceRateRows,
    listManualRateRows,
    upsertSourceRates,
    upsertSourceSuccess,
    upsertSourceFailure,
    insertManualRate,
    listPairs,
    getRateHistory,
  };
}
