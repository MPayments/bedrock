import type {
  RateSource,
  RateSourceStatus,
  RateSourceSyncResult,
  RateSourceSyncStatus,
} from "../../../shared/application/external-ports";

export type { RateSource } from "../../../shared/application/external-ports";
export type { CrossRate } from "../../domain/model";

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

export type RateHistoryPoint = RateRowRecord;

export interface RateSourceRowRecord {
  source: RateSource;
  ttlSeconds: number;
  lastSyncedAt: Date | null;
  lastPublishedAt: Date | null;
  lastStatus: RateSourceSyncStatus;
  lastError: string | null;
  updatedAt: Date;
}

export interface SourceRateWriteModel {
  baseCurrencyId: string;
  quoteCurrencyId: string;
  rateNum: bigint;
  rateDen: bigint;
  asOf: Date;
}

export interface SourceSuccessWriteModel {
  source: RateSource;
  ttlSeconds: number;
  lastSyncedAt: Date;
  lastPublishedAt: Date;
  updatedAt: Date;
}

export interface SourceFailureWriteModel {
  source: RateSource;
  ttlSeconds: number;
  lastError: string;
  updatedAt: Date;
}

export interface ManualRateWriteModel {
  baseCurrencyId: string;
  quoteCurrencyId: string;
  rateNum: bigint;
  rateDen: bigint;
  asOf: Date;
  source: string;
}

export interface RateHistoryQuery {
  base: string;
  quote: string;
  limit?: number;
  from?: Date;
}

export interface RatesRepository {
  getSourceRow(source: RateSource): Promise<RateSourceRowRecord | null>;
  initializeSourceRow(
    source: RateSource,
    ttlSeconds: number,
  ): Promise<RateSourceRowRecord | null>;
  listSourceRows(sources: RateSource[]): Promise<RateSourceRowRecord[]>;
  listSourceRateRows(
    source: RateSource,
    baseCurrencyId: string,
    quoteCurrencyId: string,
  ): Promise<RateRowRecord[]>;
  listManualRateRows(
    baseCurrencyId: string,
    quoteCurrencyId: string,
  ): Promise<RateRowRecord[]>;
  upsertSourceRates(
    source: RateSource,
    rates: SourceRateWriteModel[],
  ): Promise<void>;
  upsertSourceSuccess(input: SourceSuccessWriteModel): Promise<void>;
  upsertSourceFailure(input: SourceFailureWriteModel): Promise<void>;
  insertManualRate(input: ManualRateWriteModel): Promise<void>;
  listPairs(): Promise<RatePairView[]>;
  getRateHistory(input: RateHistoryQuery): Promise<RateHistoryPoint[]>;
}

export type { RateSourceStatus, RateSourceSyncResult };
