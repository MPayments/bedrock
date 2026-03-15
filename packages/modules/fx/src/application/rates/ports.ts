import type {
  FxRateSource,
  FxRateSourceStatus,
  FxRateSourceSyncResult,
  FxRateSourceSyncStatus,
} from "../shared/external-ports";
export type { FxRateSource } from "../shared/external-ports";

export interface RateRowRecord {
  source: string;
  rateNum: bigint;
  rateDen: bigint;
  asOf: Date;
}

export interface SourceRateView extends RateRowRecord {
  change: number | null;
  changePercent: number | null;
}

export interface RatePairView {
  baseCurrencyCode: string;
  quoteCurrencyCode: string;
  bestRate: SourceRateView;
  rates: SourceRateView[];
}

export interface RateHistoryPoint extends RateRowRecord {}

export interface FxRateSourceRowRecord {
  source: FxRateSource;
  ttlSeconds: number;
  lastSyncedAt: Date | null;
  lastPublishedAt: Date | null;
  lastStatus: FxRateSourceSyncStatus;
  lastError: string | null;
  updatedAt: Date;
}

export interface CrossRate {
  base: string;
  quote: string;
  rateNum: bigint;
  rateDen: bigint;
}

export interface FxRatesRepository {
  getSourceRow(source: FxRateSource): Promise<FxRateSourceRowRecord | null>;
  initializeSourceRow(
    source: FxRateSource,
    ttlSeconds: number,
  ): Promise<FxRateSourceRowRecord | null>;
  listSourceRows(sources: FxRateSource[]): Promise<FxRateSourceRowRecord[]>;
  listSourceRateRows(
    source: FxRateSource,
    baseCurrencyId: string,
    quoteCurrencyId: string,
  ): Promise<RateRowRecord[]>;
  listManualRateRows(
    baseCurrencyId: string,
    quoteCurrencyId: string,
  ): Promise<RateRowRecord[]>;
  upsertSourceRates(
    source: FxRateSource,
    rates: Array<{
      baseCurrencyId: string;
      quoteCurrencyId: string;
      rateNum: bigint;
      rateDen: bigint;
      asOf: Date;
    }>,
  ): Promise<void>;
  upsertSourceSuccess(input: {
    source: FxRateSource;
    ttlSeconds: number;
    lastSyncedAt: Date;
    lastPublishedAt: Date;
    updatedAt: Date;
  }): Promise<void>;
  upsertSourceFailure(input: {
    source: FxRateSource;
    ttlSeconds: number;
    lastError: string;
    updatedAt: Date;
  }): Promise<void>;
  insertManualRate(input: {
    baseCurrencyId: string;
    quoteCurrencyId: string;
    rateNum: bigint;
    rateDen: bigint;
    asOf: Date;
    source: string;
  }): Promise<void>;
  listPairs(): Promise<RatePairView[]>;
  getRateHistory(input: {
    base: string;
    quote: string;
    limit?: number;
    from?: Date;
  }): Promise<RateHistoryPoint[]>;
}

export type { FxRateSourceStatus, FxRateSourceSyncResult };
