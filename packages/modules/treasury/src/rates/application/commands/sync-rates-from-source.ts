import type { ModuleRuntime } from "@bedrock/shared/core";
import {
  DAY_IN_SECONDS,
  FIVE_MIN_IN_SECONDS,
} from "@bedrock/shared/money/math";

import {
  RateSourceStaleError,
  RateSourceSyncError,
} from "../../../errors";
import type {
  CurrenciesPort,
  RateSource,
  RateSourceProvider,
} from "../../../shared/application/external-ports";
import { TREASURY_RATE_SOURCES } from "../../domain/rate-source";
import {
  SyncRatesFromSourceInputSchema,
  type SyncRatesFromSourceInput,
} from "../contracts/commands";
import type { RateSourceSyncPort } from "../ports/rate-source-sync.port";
import type {
  RateRowRecord,
  RatesRepository,
  RateSourceRowRecord,
  RateSourceStatus,
  RateSourceSyncResult,
} from "../ports/rates.repository";

const DEFAULT_SOURCE_TTL_SECONDS: Record<RateSource, number> = {
  cbr: DAY_IN_SECONDS,
  investing: FIVE_MIN_IN_SECONDS,
  xe: FIVE_MIN_IN_SECONDS,
  grinex: FIVE_MIN_IN_SECONDS,
};

export class SyncRatesFromSourceCommand implements RateSourceSyncPort {
  private readonly syncInFlight = new Map<
    RateSource,
    Promise<RateSourceSyncResult>
  >();
  private readonly sourceStatusBySource = new Map<RateSource, RateSourceRowRecord>();
  private readonly sourceRateRowsByPair = new Map<string, RateRowRecord[]>();
  private readonly manualRateRowsByPair = new Map<string, RateRowRecord[]>();

  constructor(
    private readonly currencies: CurrenciesPort,
    private readonly runtime: ModuleRuntime,
    private readonly ratesRepository: RatesRepository,
    private readonly rateSourceProviders?: Partial<Record<RateSource, RateSourceProvider>>,
  ) {}

  async execute(
    input: SyncRatesFromSourceInput,
  ): Promise<RateSourceSyncResult> {
    const validated = SyncRatesFromSourceInputSchema.parse(input);
    const now = validated.now ?? this.runtime.now();
    const inFlight = this.syncInFlight.get(validated.source);

    if (inFlight) {
      return inFlight;
    }

    const promise = this.performSync(
      validated.source,
      validated.force ?? false,
      now,
    );
    this.syncInFlight.set(validated.source, promise);

    try {
      return await promise;
    } finally {
      this.syncInFlight.delete(validated.source);
    }
  }

  async getRateSourceStatuses(
    now = this.runtime.now(),
  ): Promise<RateSourceStatus[]> {
    const sources = [...TREASURY_RATE_SOURCES];
    if (sources.length === 0) {
      return [];
    }

    const rows = await this.ratesRepository.listSourceRows(sources);
    for (const row of rows) {
      this.setCachedSourceRow(row);
    }

    return sources.map((source) =>
      this.toStatus(
        this.sourceStatusBySource.get(source) ?? this.buildDefaultSourceRow(source),
        now,
      ),
    );
  }

  async ensureSourceFresh(
    source: RateSource,
    now = this.runtime.now(),
  ): Promise<RateSourceStatus> {
    const row = await this.getOrCreateSourceRow(source);
    const status = this.toStatus(row, now);
    if (!status.isExpired) {
      return status;
    }

    try {
      const syncResult = await this.execute({
        source,
        force: true,
        now,
      });
      return syncResult.status;
    } catch (error) {
      throw new RateSourceStaleError(source, error);
    }
  }

  async getLatestRateBySource(
    baseCurrencyId: string,
    quoteCurrencyId: string,
    asOf: Date,
    source: RateSource,
  ) {
    const rows = await this.getSourceRateRows(
      source,
      baseCurrencyId,
      quoteCurrencyId,
    );

    return this.findLatestRate(rows, asOf);
  }

  async getLatestManualRate(
    baseCurrencyId: string,
    quoteCurrencyId: string,
    asOf: Date,
  ) {
    const rows = await this.getManualRateRows(baseCurrencyId, quoteCurrencyId);
    return this.findLatestRate(rows, asOf);
  }

  invalidateRateCache() {
    this.sourceRateRowsByPair.clear();
    this.manualRateRowsByPair.clear();
  }

  private pairKey(baseCurrencyId: string, quoteCurrencyId: string) {
    return `${baseCurrencyId}|${quoteCurrencyId}`;
  }

  private sourcePairKey(
    source: RateSource,
    baseCurrencyId: string,
    quoteCurrencyId: string,
  ) {
    return `${source}|${this.pairKey(baseCurrencyId, quoteCurrencyId)}`;
  }

  private setCachedSourceRow(row: RateSourceRowRecord) {
    this.sourceStatusBySource.set(row.source, row);
  }

  private buildDefaultSourceRow(source: RateSource): RateSourceRowRecord {
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

  private getFreshnessBase(row: RateSourceRowRecord) {
    if (
      row.source === "investing" ||
      row.source === "xe" ||
      row.source === "grinex"
    ) {
      return row.lastSyncedAt ?? row.lastPublishedAt;
    }

    return row.lastPublishedAt ?? row.lastSyncedAt;
  }

  private toStatus(row: RateSourceRowRecord, now: Date): RateSourceStatus {
    const freshnessBase = this.getFreshnessBase(row);
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

  private async getSourceRow(
    source: RateSource,
  ): Promise<RateSourceRowRecord | null> {
    const cached = this.sourceStatusBySource.get(source);
    if (cached) {
      return cached;
    }

    const row = await this.ratesRepository.getSourceRow(source);
    if (row) {
      this.setCachedSourceRow(row);
    }

    return row;
  }

  private async getOrCreateSourceRow(
    source: RateSource,
  ): Promise<RateSourceRowRecord> {
    const existing = await this.getSourceRow(source);
    if (existing) {
      return existing;
    }

    const row = await this.ratesRepository.initializeSourceRow(
      source,
      DEFAULT_SOURCE_TTL_SECONDS[source],
    );

    if (!row) {
      throw new RateSourceSyncError(
        source,
        "cannot initialize source status row",
      );
    }

    this.setCachedSourceRow(row);
    return row;
  }

  private findLatestRate(rows: RateRowRecord[], asOf: Date) {
    const asOfMs = asOf.getTime();
    return rows.find((row) => row.asOf.getTime() <= asOfMs);
  }

  private async getSourceRateRows(
    source: RateSource,
    baseCurrencyId: string,
    quoteCurrencyId: string,
  ) {
    const key = this.sourcePairKey(source, baseCurrencyId, quoteCurrencyId);
    const cached = this.sourceRateRowsByPair.get(key);
    if (cached) {
      return cached;
    }

    const rows = await this.ratesRepository.listSourceRateRows(
      source,
      baseCurrencyId,
      quoteCurrencyId,
    );
    this.sourceRateRowsByPair.set(key, rows);
    return rows;
  }

  private async getManualRateRows(
    baseCurrencyId: string,
    quoteCurrencyId: string,
  ) {
    const key = this.pairKey(baseCurrencyId, quoteCurrencyId);
    const cached = this.manualRateRowsByPair.get(key);
    if (cached) {
      return cached;
    }

    const rows = await this.ratesRepository.listManualRateRows(
      baseCurrencyId,
      quoteCurrencyId,
    );
    this.manualRateRowsByPair.set(key, rows);
    return rows;
  }

  private async persistRates(
    source: RateSource,
    rates: {
      base: string;
      quote: string;
      rateNum: bigint;
      rateDen: bigint;
      asOf: Date;
    }[],
  ): Promise<number> {
    const deduped = new Map<string, (typeof rates)[number]>();
    for (const rate of rates) {
      deduped.set(`${rate.base}|${rate.quote}|${rate.asOf.toISOString()}`, rate);
    }

    const dedupedRates = [...deduped.values()];
    const currencyCodes = [
      ...new Set(dedupedRates.flatMap((rate) => [rate.base, rate.quote])),
    ];
    const currencyIdByCode = new Map<string, string>();

    for (const code of currencyCodes) {
      try {
        const currency = await this.currencies.findByCode(code);
        currencyIdByCode.set(currency.code, currency.id);
      } catch {
        this.runtime.log.warn("Skip rate for unknown currency", {
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

    await this.ratesRepository.upsertSourceRates(
      source,
      validRows.map((rate) => ({
        baseCurrencyId: currencyIdByCode.get(rate.base)!,
        quoteCurrencyId: currencyIdByCode.get(rate.quote)!,
        rateNum: rate.rateNum,
        rateDen: rate.rateDen,
        asOf: rate.asOf,
      })),
    );

    this.invalidateRateCache();
    return validRows.length;
  }

  private async markSyncSuccess(
    source: RateSource,
    now: Date,
    publishedAt: Date,
  ) {
    await this.ratesRepository.upsertSourceSuccess({
      source,
      ttlSeconds: DEFAULT_SOURCE_TTL_SECONDS[source],
      lastSyncedAt: now,
      lastPublishedAt: publishedAt,
      updatedAt: now,
    });

    this.setCachedSourceRow({
      source,
      ttlSeconds: DEFAULT_SOURCE_TTL_SECONDS[source],
      lastSyncedAt: now,
      lastPublishedAt: publishedAt,
      lastStatus: "ok",
      lastError: null,
      updatedAt: now,
    });
  }

  private async markSyncFailure(
    source: RateSource,
    now: Date,
    error: unknown,
  ) {
    const message = extractErrorMessage(error);

    await this.ratesRepository.upsertSourceFailure({
      source,
      ttlSeconds: DEFAULT_SOURCE_TTL_SECONDS[source],
      lastError: message,
      updatedAt: now,
    });

    const previous =
      this.sourceStatusBySource.get(source) ?? this.buildDefaultSourceRow(source);
    this.setCachedSourceRow({
      ...previous,
      source,
      lastStatus: "error",
      lastError: message,
      updatedAt: now,
    });
  }

  private async performSync(
    source: RateSource,
    force: boolean,
    now: Date,
  ): Promise<RateSourceSyncResult> {
    const sourceStatus = await this.getOrCreateSourceRow(source);
    const currentStatus = this.toStatus(sourceStatus, now);
    if (!force && !currentStatus.isExpired) {
      return {
        source,
        synced: false,
        rateCount: 0,
        publishedAt: sourceStatus.lastPublishedAt,
        status: currentStatus,
      };
    }

    const provider = this.rateSourceProviders?.[source];
    if (!provider) {
      throw new RateSourceSyncError(source, "provider is not configured");
    }

    try {
      const payload = await provider.fetchLatest(now);
      const rateCount = await this.persistRates(source, payload.rates);
      await this.markSyncSuccess(source, now, payload.publishedAt);

      const nextRow = await this.getOrCreateSourceRow(source);
      return {
        source,
        synced: true,
        rateCount,
        publishedAt: payload.publishedAt,
        status: this.toStatus(nextRow, now),
      };
    } catch (error) {
      await this.markSyncFailure(source, now, error);
      throw new RateSourceSyncError(source, "sync failed", error);
    }
  }
}

function extractErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.length > 2000 ? `${message.slice(0, 1997)}...` : message;
}
