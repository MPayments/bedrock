import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";

import type { FxRate, FxRateSourceRow } from "@bedrock/db/schema";
import { schema } from "@bedrock/db/schema";
import { DAY_IN_SECONDS } from "@bedrock/kernel/constants";

import { RateSourceStaleError, RateSourceSyncError } from "../../errors";
import { type FxServiceContext } from "../../internal/context";
import {
  type FxRateSource,
  type FxRateSourceStatus,
  type FxRateSourceSyncResult,
} from "../../sources/types";
import { validateSyncRatesFromSourceInput } from "../../validation";

const DEFAULT_SOURCE_TTL_SECONDS: Record<FxRateSource, number> = {
  cbr: DAY_IN_SECONDS,
  investing: 300,
};

// FIXME: Use redis/valkey for caching in the future
export function createRateSourceHandlers(context: FxServiceContext) {
  const { db, currenciesService, log, rateSourceProviders } = context;
  const syncInFlight = new Map<FxRateSource, Promise<FxRateSourceSyncResult>>();
  const sourceStatusBySource = new Map<FxRateSource, FxRateSourceRow>();
  let sourceStatusCacheLoaded = false;
  const sourceRateRowsByPair = new Map<string, FxRate[]>();
  const manualRateRowsByPair = new Map<string, FxRate[]>();

  function configuredSources(): FxRateSource[] {
    return Object.keys(rateSourceProviders) as FxRateSource[];
  }

  function pairKey(baseCurrencyId: string, quoteCurrencyId: string) {
    return `${baseCurrencyId}|${quoteCurrencyId}`;
  }

  function sourcePairKey(
    source: FxRateSource,
    baseCurrencyId: string,
    quoteCurrencyId: string,
  ) {
    return `${source}|${pairKey(baseCurrencyId, quoteCurrencyId)}`;
  }

  function invalidateRateCache() {
    sourceRateRowsByPair.clear();
    manualRateRowsByPair.clear();
  }

  function setCachedSourceRow(row: FxRateSourceRow) {
    sourceStatusBySource.set(row.source, row);
  }

  // TODO: Consider using redis/valkey for caching in the future
  async function warmSourceStatusCache() {
    if (sourceStatusCacheLoaded) return;
    const sources = configuredSources();
    if (!sources.length) {
      sourceStatusCacheLoaded = true;
      return;
    }

    const rows = await db
      .select()
      .from(schema.fxRateSources)
      .where(inArray(schema.fxRateSources.source, sources))
      .orderBy(schema.fxRateSources.source);

    for (const row of rows) {
      setCachedSourceRow(row);
    }

    sourceStatusCacheLoaded = true;
  }

  function buildDefaultSourceRow(source: FxRateSource): FxRateSourceRow {
    return {
      source,
      ttlSeconds: DEFAULT_SOURCE_TTL_SECONDS[source],
      lastSyncedAt: null,
      lastPublishedAt: null,
      lastStatus: "idle",
      lastError: null,
      updatedAt: new Date(0),
    };
  }

  function toStatus(row: FxRateSourceRow, now: Date): FxRateSourceStatus {
    // CBR freshness should follow publication time, not sync time.
    // If a sync happened late in the day, anchoring TTL to lastSyncedAt
    // can keep yesterday's publication "fresh" for too long.
    const freshnessBase = row.lastPublishedAt ?? row.lastSyncedAt;
    const expiresAt = freshnessBase
      ? new Date(freshnessBase.getTime() + row.ttlSeconds * 1000)
      : null;

    return {
      source: row.source,
      ttlSeconds: row.ttlSeconds,
      lastSyncedAt: row.lastSyncedAt,
      lastPublishedAt: row.lastPublishedAt,
      lastStatus: row.lastStatus,
      lastError: row.lastError,
      expiresAt,
      isExpired: !expiresAt || expiresAt.getTime() <= now.getTime(),
    };
  }

  async function getSourceRow(
    source: FxRateSource,
  ): Promise<FxRateSourceRow | null> {
    const cached = sourceStatusBySource.get(source);
    if (cached) return cached;

    const [row] = await db
      .select()
      .from(schema.fxRateSources)
      .where(eq(schema.fxRateSources.source, source))
      .limit(1);

    if (row) {
      setCachedSourceRow(row);
    }

    return row ?? null;
  }

  async function getOrCreateSourceRow(
    source: FxRateSource,
  ): Promise<FxRateSourceRow> {
    const existing = await getSourceRow(source);
    if (existing) return existing;

    const [inserted] = await db
      .insert(schema.fxRateSources)
      .values({
        source,
        ttlSeconds: DEFAULT_SOURCE_TTL_SECONDS[source],
        lastStatus: "idle",
      })
      .onConflictDoNothing({
        target: schema.fxRateSources.source,
      })
      .returning();

    if (inserted) {
      setCachedSourceRow(inserted);
      return inserted;
    }

    const raced = await getSourceRow(source);
    if (!raced) {
      throw new RateSourceSyncError(
        source,
        "cannot initialize source status row",
      );
    }

    return raced;
  }

  async function getRateSourceStatuses(
    now = new Date(),
  ): Promise<FxRateSourceStatus[]> {
    const sources = configuredSources();
    if (!sources.length) return [];

    const rows = await db
      .select()
      .from(schema.fxRateSources)
      .where(inArray(schema.fxRateSources.source, sources))
      .orderBy(schema.fxRateSources.source);

    for (const row of rows) {
      setCachedSourceRow(row);
    }
    sourceStatusCacheLoaded = true;

    return sources.map((source) =>
      toStatus(
        sourceStatusBySource.get(source) ?? buildDefaultSourceRow(source),
        now,
      ),
    );
  }

  function findLatestRate(rows: FxRate[], asOf: Date) {
    const asOfMs = asOf.getTime();
    for (const row of rows) {
      if (row.asOf.getTime() <= asOfMs) {
        return row;
      }
    }
    return undefined;
  }

  async function getSourceRateRows(
    source: FxRateSource,
    baseCurrencyId: string,
    quoteCurrencyId: string,
  ) {
    const key = sourcePairKey(source, baseCurrencyId, quoteCurrencyId);
    const cached = sourceRateRowsByPair.get(key);
    if (cached) return cached;

    const rows = await db
      .select()
      .from(schema.fxRates)
      .where(
        and(
          eq(schema.fxRates.source, source),
          eq(schema.fxRates.baseCurrencyId, baseCurrencyId),
          eq(schema.fxRates.quoteCurrencyId, quoteCurrencyId),
        ),
      )
      .orderBy(desc(schema.fxRates.asOf), desc(schema.fxRates.createdAt));

    sourceRateRowsByPair.set(key, rows);
    return rows;
  }

  async function getManualRateRows(
    baseCurrencyId: string,
    quoteCurrencyId: string,
  ) {
    const key = pairKey(baseCurrencyId, quoteCurrencyId);
    const cached = manualRateRowsByPair.get(key);
    if (cached) return cached;

    const rows = await db
      .select()
      .from(schema.fxRates)
      .where(
        and(
          ne(schema.fxRates.source, "cbr"),
          ne(schema.fxRates.source, "investing"),
          eq(schema.fxRates.baseCurrencyId, baseCurrencyId),
          eq(schema.fxRates.quoteCurrencyId, quoteCurrencyId),
        ),
      )
      .orderBy(desc(schema.fxRates.asOf), desc(schema.fxRates.createdAt));

    manualRateRowsByPair.set(key, rows);
    return rows;
  }

  async function persistRates(
    source: FxRateSource,
    rates: {
      base: string;
      quote: string;
      rateNum: bigint;
      rateDen: bigint;
      asOf: Date;
    }[],
  ): Promise<number> {
    const dedupedMap = new Map<string, (typeof rates)[number]>();
    for (const rate of rates) {
      dedupedMap.set(
        `${rate.base}|${rate.quote}|${rate.asOf.toISOString()}`,
        rate,
      );
    }
    const dedupedRates = [...dedupedMap.values()];

    const currencyCodes = [
      ...new Set(dedupedRates.flatMap((rate) => [rate.base, rate.quote])),
    ];
    const currencyIdByCode = new Map<string, string>();

    for (const code of currencyCodes) {
      try {
        const currency = await currenciesService.findByCode(code);
        currencyIdByCode.set(currency.code, currency.id);
      } catch {
        log.warn("Skip FX rate for unknown currency", {
          source,
          currency: code,
        });
      }
    }

    const validRows = dedupedRates.filter(
      (rate) =>
        currencyIdByCode.has(rate.base) && currencyIdByCode.has(rate.quote),
    );
    if (!validRows.length) {
      throw new RateSourceSyncError(
        source,
        "provider returned no rates for known currencies",
      );
    }

    await db
      .insert(schema.fxRates)
      .values(
        validRows.map((rate) => ({
          source,
          baseCurrencyId: currencyIdByCode.get(rate.base)!,
          quoteCurrencyId: currencyIdByCode.get(rate.quote)!,
          rateNum: rate.rateNum,
          rateDen: rate.rateDen,
          asOf: rate.asOf,
        })),
      )
      .onConflictDoUpdate({
        target: [
          schema.fxRates.source,
          schema.fxRates.baseCurrencyId,
          schema.fxRates.quoteCurrencyId,
          schema.fxRates.asOf,
        ],
        set: {
          rateNum: sql`excluded.rate_num`,
          rateDen: sql`excluded.rate_den`,
        },
      });

    invalidateRateCache();
    return validRows.length;
  }

  async function markSyncSuccess(
    source: FxRateSource,
    now: Date,
    publishedAt: Date,
  ) {
    await db
      .insert(schema.fxRateSources)
      .values({
        source,
        ttlSeconds: DEFAULT_SOURCE_TTL_SECONDS[source],
        lastSyncedAt: now,
        lastPublishedAt: publishedAt,
        lastStatus: "ok",
        lastError: null,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: schema.fxRateSources.source,
        set: {
          ttlSeconds: DEFAULT_SOURCE_TTL_SECONDS[source],
          lastSyncedAt: now,
          lastPublishedAt: publishedAt,
          lastStatus: "ok",
          lastError: null,
          updatedAt: now,
        },
      });

    setCachedSourceRow({
      source,
      ttlSeconds: DEFAULT_SOURCE_TTL_SECONDS[source],
      lastSyncedAt: now,
      lastPublishedAt: publishedAt,
      lastStatus: "ok",
      lastError: null,
      updatedAt: now,
    });
  }

  async function markSyncFailure(
    source: FxRateSource,
    now: Date,
    error: unknown,
  ) {
    const message = extractErrorMessage(error);

    await db
      .insert(schema.fxRateSources)
      .values({
        source,
        ttlSeconds: DEFAULT_SOURCE_TTL_SECONDS[source],
        lastStatus: "error",
        lastError: message,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: schema.fxRateSources.source,
        set: {
          lastStatus: "error",
          lastError: message,
          updatedAt: now,
        },
      });

    const previous =
      sourceStatusBySource.get(source) ?? buildDefaultSourceRow(source);
    setCachedSourceRow({
      ...previous,
      source,
      lastStatus: "error",
      lastError: message,
      updatedAt: now,
    });
  }

  async function performSync(
    source: FxRateSource,
    force: boolean,
    now: Date,
  ): Promise<FxRateSourceSyncResult> {
    const sourceStatus = await getOrCreateSourceRow(source);
    const currentStatus = toStatus(sourceStatus, now);
    if (!force && !currentStatus.isExpired) {
      return {
        source,
        synced: false,
        rateCount: 0,
        publishedAt: sourceStatus.lastPublishedAt,
        status: currentStatus,
      };
    }

    const provider = rateSourceProviders[source];
    if (!provider) {
      throw new RateSourceSyncError(source, "provider is not configured");
    }

    try {
      const payload = await provider.fetchLatest(now);
      const rateCount = await persistRates(source, payload.rates);
      await markSyncSuccess(source, now, payload.publishedAt);

      const nextRow = await getOrCreateSourceRow(source);
      return {
        source,
        synced: true,
        rateCount,
        publishedAt: payload.publishedAt,
        status: toStatus(nextRow, now),
      };
    } catch (error) {
      await markSyncFailure(source, now, error);
      throw new RateSourceSyncError(source, "sync failed", error);
    }
  }

  async function syncRatesFromSource(input: {
    source: FxRateSource;
    force?: boolean;
    now?: Date;
  }): Promise<FxRateSourceSyncResult> {
    const validated = validateSyncRatesFromSourceInput(input);
    const now = validated.now ?? new Date();

    const existing = syncInFlight.get(validated.source);
    if (existing) {
      return existing;
    }

    const promise = performSync(
      validated.source,
      validated.force ?? false,
      now,
    );
    syncInFlight.set(validated.source, promise);

    try {
      return await promise;
    } finally {
      syncInFlight.delete(validated.source);
    }
  }

  async function ensureSourceFresh(
    source: FxRateSource,
    now = new Date(),
  ): Promise<FxRateSourceStatus> {
    const row = await getOrCreateSourceRow(source);
    const status = toStatus(row, now);
    if (!status.isExpired) {
      return status;
    }

    try {
      const syncResult = await syncRatesFromSource({
        source,
        force: true,
        now,
      });
      return syncResult.status;
    } catch (error) {
      throw new RateSourceStaleError(source, error);
    }
  }

  async function getLatestRateBySource(
    baseCurrencyId: string,
    quoteCurrencyId: string,
    asOf: Date,
    source: FxRateSource,
  ) {
    const rows = await getSourceRateRows(
      source,
      baseCurrencyId,
      quoteCurrencyId,
    );
    return findLatestRate(rows, asOf);
  }

  async function getLatestManualRate(
    baseCurrencyId: string,
    quoteCurrencyId: string,
    asOf: Date,
  ) {
    const rows = await getManualRateRows(baseCurrencyId, quoteCurrencyId);
    return findLatestRate(rows, asOf);
  }

  return {
    getRateSourceStatuses,
    syncRatesFromSource,
    ensureSourceFresh,
    getLatestRateBySource,
    getLatestManualRate,
    invalidateRateCache,
  };
}

function extractErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.length > 2000 ? `${message.slice(0, 1997)}...` : message;
}
