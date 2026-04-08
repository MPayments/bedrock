import { and, desc, eq, inArray, notInArray, sql } from "drizzle-orm";

import type { Database } from "@bedrock/platform/persistence/drizzle";
import { formatFractionDecimal } from "@bedrock/shared/money";

import { schema as fxSchema } from "../../../schema";
import type {
  ManualRateWriteModel,
  RateHistoryPoint,
  RateHistoryQuery,
  RatePairView,
  RateRowRecord,
  RatesRepository,
  RateSource,
  RateSourceRowRecord,
  SourceFailureWriteModel,
  SourceRateWriteModel,
  SourceRateView,
  SourceSuccessWriteModel,
} from "../../application/ports";
import { RateBook } from "../../domain/rate-book";
import { TREASURY_RATE_SOURCES } from "../../domain/rate-source";

function computeRate(num: bigint, den: bigint): number {
  return Number(
    formatFractionDecimal(num, den, {
      scale: 12,
      trimTrailingZeros: false,
    }),
  );
}

function getSourcePriority(source: string, order: RateSource[]): number {
  if (source === "manual") {
    return -1;
  }

  const index = order.indexOf(source as RateSource);
  if (index === -1) {
    throw new Error(`Unknown treasury rate source: ${source}`);
  }

  return index;
}

export class DrizzleTreasuryRatesRepository implements RatesRepository {
  constructor(private readonly db: Database) {}

  async getSourceRow(source: RateSource): Promise<RateSourceRowRecord | null> {
    const [row] = await this.db
      .select()
      .from(fxSchema.fxRateSources)
      .where(eq(fxSchema.fxRateSources.source, source))
      .limit(1);

    return (row as RateSourceRowRecord | undefined) ?? null;
  }

  async initializeSourceRow(
    source: RateSource,
    ttlSeconds: number,
  ): Promise<RateSourceRowRecord | null> {
    const [inserted] = await this.db
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
      return inserted as RateSourceRowRecord;
    }

    return this.getSourceRow(source);
  }

  async listSourceRows(sources: RateSource[]): Promise<RateSourceRowRecord[]> {
    if (sources.length === 0) {
      return [];
    }

    const rows = await this.db
      .select()
      .from(fxSchema.fxRateSources)
      .where(inArray(fxSchema.fxRateSources.source, sources))
      .orderBy(fxSchema.fxRateSources.source);

    return rows as RateSourceRowRecord[];
  }

  async listSourceRateRows(
    source: RateSource,
    baseCurrencyId: string,
    quoteCurrencyId: string,
  ): Promise<RateRowRecord[]> {
    const rows = await this.db
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

  async listManualRateRows(
    baseCurrencyId: string,
    quoteCurrencyId: string,
  ): Promise<RateRowRecord[]> {
    const rows = await this.db
      .select()
      .from(fxSchema.fxRates)
      .where(
        and(
          notInArray(
            fxSchema.fxRates.source,
            TREASURY_RATE_SOURCES as unknown as string[],
          ),
          eq(fxSchema.fxRates.baseCurrencyId, baseCurrencyId),
          eq(fxSchema.fxRates.quoteCurrencyId, quoteCurrencyId),
        ),
      )
      .orderBy(desc(fxSchema.fxRates.asOf), desc(fxSchema.fxRates.createdAt));

    return rows as RateRowRecord[];
  }

  async upsertSourceRates(
    source: RateSource,
    rates: SourceRateWriteModel[],
  ): Promise<void> {
    if (rates.length === 0) {
      return;
    }

    await this.db
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

  async upsertSourceSuccess(input: SourceSuccessWriteModel): Promise<void> {
    await this.db
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

  async upsertSourceFailure(input: SourceFailureWriteModel): Promise<void> {
    await this.db
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

  async insertManualRate(input: ManualRateWriteModel): Promise<void> {
    await this.db.insert(fxSchema.fxRates).values(input);
  }

  async listPairs(): Promise<RatePairView[]> {
    const fr = fxSchema.fxRates;

    const rows = await this.db.execute<{
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
      const order = RateBook.forPair(baseCode!, quoteCode!).preferredSources();

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

      rates.sort(
        (left, right) =>
          getSourcePriority(left.source, order) -
          getSourcePriority(right.source, order),
      );

      result.push({
        baseCurrencyCode: baseCode!,
        quoteCurrencyCode: quoteCode!,
        bestRate: rates[0]!,
        rates,
      });
    }

    result.sort((left, right) => {
      if (left.baseCurrencyCode !== right.baseCurrencyCode) {
        return left.baseCurrencyCode.localeCompare(right.baseCurrencyCode);
      }

      return left.quoteCurrencyCode.localeCompare(right.quoteCurrencyCode);
    });

    return result;
  }

  async getRateHistory(input: RateHistoryQuery): Promise<RateHistoryPoint[]> {
    const conditions = [
      eq(sql<string>`bc.code`, input.base),
      eq(sql<string>`qc.code`, input.quote),
    ];

    if (input.from) {
      conditions.push(sql`${fxSchema.fxRates.asOf} >= ${input.from}`);
    }

    const rows = await this.db.execute<{
      source: string;
      rate_num: string;
      rate_den: string;
      as_of: string;
    }>(sql`
      SELECT
        ${fxSchema.fxRates.source} AS source,
        ${fxSchema.fxRates.rateNum}::text AS rate_num,
        ${fxSchema.fxRates.rateDen}::text AS rate_den,
        ${fxSchema.fxRates.asOf} AS as_of
      FROM ${fxSchema.fxRates}
      JOIN "currencies" bc ON bc.id = ${fxSchema.fxRates.baseCurrencyId}
      JOIN "currencies" qc ON qc.id = ${fxSchema.fxRates.quoteCurrencyId}
      WHERE ${and(...conditions)}
      ORDER BY ${fxSchema.fxRates.asOf} DESC, ${fxSchema.fxRates.createdAt} DESC
      LIMIT ${input.limit ?? 100}
    `);

    return rows.rows
      .map((row) => ({
        source: row.source,
        rateNum: BigInt(row.rate_num),
        rateDen: BigInt(row.rate_den),
        asOf: new Date(row.as_of),
      }))
      .reverse();
  }
}
