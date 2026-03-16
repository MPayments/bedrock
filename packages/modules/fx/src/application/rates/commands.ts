import {
  DAY_IN_SECONDS,
  FIVE_MIN_IN_SECONDS,
} from "@bedrock/shared/money/math";

import { RateSourceStaleError, RateSourceSyncError } from "../../errors";
import { FX_RATE_SOURCES } from "../../domain/rate-source";
import type {
  FxRateSourceRowRecord,
  FxRateSourceStatus,
  FxRateSourceSyncResult,
  RateRowRecord,
} from "./ports";
import type {
  FxRateSource,
  FxRateSourceProvider,
} from "../shared/external-ports";
import type { FxServiceContext } from "../shared/context";
import {
  type SetManualRateInput,
  type SyncRatesFromSourceInput,
  validateSetManualRateInput,
  validateSyncRatesFromSourceInput,
} from "../validation";

const DEFAULT_SOURCE_TTL_SECONDS: Record<FxRateSource, number> = {
  cbr: DAY_IN_SECONDS,
  investing: FIVE_MIN_IN_SECONDS,
  xe: FIVE_MIN_IN_SECONDS,
};

export function createFxRateCommandHandlers(context: FxServiceContext) {
  const { currenciesService, ratesRepository, log, rateSourceProviders } =
    context;
  const syncInFlight = new Map<FxRateSource, Promise<FxRateSourceSyncResult>>();
  const sourceStatusBySource = new Map<FxRateSource, FxRateSourceRowRecord>();
  const sourceRateRowsByPair = new Map<string, RateRowRecord[]>();
  const manualRateRowsByPair = new Map<string, RateRowRecord[]>();

  function configuredSources(): FxRateSource[] {
    return [...FX_RATE_SOURCES];
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

  function setCachedSourceRow(row: FxRateSourceRowRecord) {
    sourceStatusBySource.set(row.source, row);
  }

  function buildDefaultSourceRow(source: FxRateSource): FxRateSourceRowRecord {
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

  function getFreshnessBase(row: FxRateSourceRowRecord) {
    if (row.source === "investing" || row.source === "xe") {
      return row.lastSyncedAt ?? row.lastPublishedAt;
    }

    return row.lastPublishedAt ?? row.lastSyncedAt;
  }

  function toStatus(row: FxRateSourceRowRecord, now: Date): FxRateSourceStatus {
    const freshnessBase = getFreshnessBase(row);
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
  ): Promise<FxRateSourceRowRecord | null> {
    const cached = sourceStatusBySource.get(source);
    if (cached) {
      return cached;
    }

    const row = await ratesRepository.getSourceRow(source);
    if (row) {
      setCachedSourceRow(row);
    }

    return row;
  }

  async function getOrCreateSourceRow(
    source: FxRateSource,
  ): Promise<FxRateSourceRowRecord> {
    const existing = await getSourceRow(source);
    if (existing) {
      return existing;
    }

    const row = await ratesRepository.initializeSourceRow(
      source,
      DEFAULT_SOURCE_TTL_SECONDS[source],
    );

    if (!row) {
      throw new RateSourceSyncError(
        source,
        "cannot initialize source status row",
      );
    }

    setCachedSourceRow(row);
    return row;
  }

  async function getRateSourceStatuses(
    now = new Date(),
  ): Promise<FxRateSourceStatus[]> {
    const sources = configuredSources();
    if (sources.length === 0) {
      return [];
    }

    const rows = await ratesRepository.listSourceRows(sources);
    for (const row of rows) {
      setCachedSourceRow(row);
    }

    return sources.map((source) =>
      toStatus(
        sourceStatusBySource.get(source) ?? buildDefaultSourceRow(source),
        now,
      ),
    );
  }

  function findLatestRate(rows: RateRowRecord[], asOf: Date) {
    const asOfMs = asOf.getTime();
    return rows.find((row) => row.asOf.getTime() <= asOfMs);
  }

  async function getSourceRateRows(
    source: FxRateSource,
    baseCurrencyId: string,
    quoteCurrencyId: string,
  ) {
    const key = sourcePairKey(source, baseCurrencyId, quoteCurrencyId);
    const cached = sourceRateRowsByPair.get(key);
    if (cached) {
      return cached;
    }

    const rows = await ratesRepository.listSourceRateRows(
      source,
      baseCurrencyId,
      quoteCurrencyId,
    );
    sourceRateRowsByPair.set(key, rows);
    return rows;
  }

  async function getManualRateRows(
    baseCurrencyId: string,
    quoteCurrencyId: string,
  ) {
    const key = pairKey(baseCurrencyId, quoteCurrencyId);
    const cached = manualRateRowsByPair.get(key);
    if (cached) {
      return cached;
    }

    const rows = await ratesRepository.listManualRateRows(
      baseCurrencyId,
      quoteCurrencyId,
    );
    manualRateRowsByPair.set(key, rows);
    return rows;
  }

  async function persistRates(
    source: FxRateSource,
    rates: Array<{
      base: string;
      quote: string;
      rateNum: bigint;
      rateDen: bigint;
      asOf: Date;
    }>,
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
    if (validRows.length === 0) {
      throw new RateSourceSyncError(
        source,
        "provider returned no rates for known currencies",
      );
    }

    await ratesRepository.upsertSourceRates(
      source,
      validRows.map((rate) => ({
        baseCurrencyId: currencyIdByCode.get(rate.base)!,
        quoteCurrencyId: currencyIdByCode.get(rate.quote)!,
        rateNum: rate.rateNum,
        rateDen: rate.rateDen,
        asOf: rate.asOf,
      })),
    );

    invalidateRateCache();
    return validRows.length;
  }

  async function markSyncSuccess(
    source: FxRateSource,
    now: Date,
    publishedAt: Date,
  ) {
    await ratesRepository.upsertSourceSuccess({
      source,
      ttlSeconds: DEFAULT_SOURCE_TTL_SECONDS[source],
      lastSyncedAt: now,
      lastPublishedAt: publishedAt,
      updatedAt: now,
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

    await ratesRepository.upsertSourceFailure({
      source,
      ttlSeconds: DEFAULT_SOURCE_TTL_SECONDS[source],
      lastError: message,
      updatedAt: now,
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

  async function syncRatesFromSource(
    input: SyncRatesFromSourceInput,
  ): Promise<FxRateSourceSyncResult> {
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

  async function setManualRate(input: SetManualRateInput): Promise<void> {
    const validated = validateSetManualRateInput(input);
    const { id: baseCurrencyId } = await currenciesService.findByCode(
      validated.base,
    );
    const { id: quoteCurrencyId } = await currenciesService.findByCode(
      validated.quote,
    );

    await ratesRepository.insertManualRate({
      baseCurrencyId,
      quoteCurrencyId,
      rateNum: validated.rateNum,
      rateDen: validated.rateDen,
      asOf: validated.asOf,
      source: validated.source ?? "manual",
    });

    invalidateRateCache();
  }

  async function expireOldQuotes(now: Date): Promise<void> {
    await context.quotesRepository.expireOldQuotes(now);
  }

  return {
    setManualRate,
    syncRatesFromSource,
    expireOldQuotes,
    getRateSourceStatuses,
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
