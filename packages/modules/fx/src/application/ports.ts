import type { FinancialLine } from "@bedrock/documents/contracts";
import type {
  CalculateFxQuoteFeeComponentsInput,
  FeeComponent,
  GetQuoteFeeComponentsInput,
  SaveQuoteFeeComponentsInput,
} from "@bedrock/fees/contracts";
import type { Queryable } from "@bedrock/platform/persistence";

import type {
  FxRateSource,
  FxRateSourceSyncStatus,
} from "../domain/rate-source";
export type { FxRateSource, FxRateSourceSyncStatus } from "../domain/rate-source";

export type FxDbExecutor = Queryable;

export interface FxCurrencyRecord {
  id: string;
  code: string;
}

export interface FxCurrenciesPort {
  findByCode(code: string): Promise<FxCurrencyRecord>;
  findById(id: string): Promise<FxCurrencyRecord>;
}

export interface FxQuoteFeesPort {
  calculateFxQuoteFeeComponents(
    input: CalculateFxQuoteFeeComponentsInput,
    executor?: FxDbExecutor,
  ): Promise<FeeComponent[]>;
  getQuoteFeeComponents(
    input: GetQuoteFeeComponentsInput,
    executor?: FxDbExecutor,
  ): Promise<FeeComponent[]>;
  saveQuoteFeeComponents(
    input: SaveQuoteFeeComponentsInput,
    executor?: FxDbExecutor,
  ): Promise<void>;
}

export interface FxTransactionsPort {
  runInTransaction<T>(
    callback: (executor: FxDbExecutor) => Promise<T>,
  ): Promise<T>;
}

export interface FxRateSourceStatus {
  source: FxRateSource;
  ttlSeconds: number;
  lastSyncedAt: Date | null;
  lastPublishedAt: Date | null;
  lastStatus: FxRateSourceSyncStatus;
  lastError: string | null;
  expiresAt: Date | null;
  isExpired: boolean;
}

export interface FxRateRecord {
  base: string;
  quote: string;
  rateNum: bigint;
  rateDen: bigint;
  asOf: Date;
}

export interface FxRateSourceFetchResult {
  source: FxRateSource;
  fetchedAt: Date;
  publishedAt: Date;
  rates: FxRateRecord[];
}

export interface FxRateSourceProvider {
  source: FxRateSource;
  fetchLatest(now?: Date): Promise<FxRateSourceFetchResult>;
}

export interface FxRateSourceSyncResult {
  source: FxRateSource;
  synced: boolean;
  rateCount: number;
  publishedAt: Date | null;
  status: FxRateSourceStatus;
}

export type FxQuoteStatus = "active" | "used" | "expired" | "cancelled";
export type FxQuotePricingMode = "auto_cross" | "explicit_route";
export type FxQuoteLegSourceKind =
  | "cb"
  | "bank"
  | "manual"
  | "derived"
  | "market";

export interface FxQuoteRecord {
  id: string;
  fromCurrencyId: string;
  toCurrencyId: string;
  fromAmountMinor: bigint;
  toAmountMinor: bigint;
  pricingMode: FxQuotePricingMode;
  pricingTrace: Record<string, unknown> | null;
  dealDirection: string | null;
  dealForm: string | null;
  rateNum: bigint;
  rateDen: bigint;
  status: FxQuoteStatus;
  usedByRef: string | null;
  usedAt: Date | null;
  expiresAt: Date;
  idempotencyKey: string;
  createdAt: Date;
  fromCurrency?: string;
  toCurrency?: string;
}

export interface FxQuoteLegRecord {
  id: string;
  quoteId: string;
  idx: number;
  fromCurrencyId: string;
  toCurrencyId: string;
  fromAmountMinor: bigint;
  toAmountMinor: bigint;
  rateNum: bigint;
  rateDen: bigint;
  sourceKind: FxQuoteLegSourceKind;
  sourceRef: string | null;
  asOf: Date;
  executionCounterpartyId: string | null;
  createdAt: Date;
  fromCurrency?: string;
  toCurrency?: string;
}

export interface FxQuoteDetailsRecord {
  quote: FxQuoteRecord;
  legs: FxQuoteLegRecord[];
  feeComponents: FeeComponent[];
  financialLines: FinancialLine[];
  pricingTrace: Record<string, unknown>;
}

export interface ComputedLeg {
  idx: number;
  fromCurrency: string;
  toCurrency: string;
  fromAmountMinor: bigint;
  toAmountMinor: bigint;
  rateNum: bigint;
  rateDen: bigint;
  sourceKind: FxQuoteLegSourceKind;
  sourceRef: string | null;
  asOf: Date;
  executionCounterpartyId: string | null;
}

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

export interface FxQuoteWriteModel {
  fromCurrencyId: string;
  toCurrencyId: string;
  fromAmountMinor: bigint;
  toAmountMinor: bigint;
  pricingMode: FxQuotePricingMode;
  pricingTrace: Record<string, unknown>;
  dealDirection: string | null;
  dealForm: string | null;
  rateNum: bigint;
  rateDen: bigint;
  expiresAt: Date;
  status: FxQuoteStatus;
  idempotencyKey: string;
}

export interface FxQuoteLegWriteModel {
  quoteId: string;
  idx: number;
  fromCurrencyId: string;
  toCurrencyId: string;
  fromAmountMinor: bigint;
  toAmountMinor: bigint;
  rateNum: bigint;
  rateDen: bigint;
  sourceKind: FxQuoteLegSourceKind;
  sourceRef: string | null;
  asOf: Date;
  executionCounterpartyId: string | null;
}

export interface FxQuoteFinancialLineWriteModel {
  quoteId: string;
  idx: number;
  bucket: FinancialLine["bucket"];
  currencyId: string;
  amountMinor: bigint;
  source: FinancialLine["source"];
  settlementMode: NonNullable<FinancialLine["settlementMode"]>;
  memo: string | null;
  metadata: Record<string, string> | null;
}

export interface FxQuotesRepositoryPort {
  insertQuote(
    input: FxQuoteWriteModel,
    executor?: FxDbExecutor,
  ): Promise<FxQuoteRecord | null>;
  insertQuoteLegs(
    input: FxQuoteLegWriteModel[],
    executor?: FxDbExecutor,
  ): Promise<void>;
  listQuotes(input: {
    limit: number;
    offset: number;
    sortBy: string;
    sortOrder: "asc" | "desc";
    idempotencyKey?: string;
    status?: string[];
    pricingMode?: string[];
  }): Promise<{ rows: FxQuoteRecord[]; total: number }>;
  findQuoteById(id: string, executor?: FxDbExecutor): Promise<FxQuoteRecord | undefined>;
  findQuoteByIdempotencyKey(
    idempotencyKey: string,
    executor?: FxDbExecutor,
  ): Promise<FxQuoteRecord | undefined>;
  listQuoteLegs(
    quoteId: string,
    executor?: FxDbExecutor,
  ): Promise<FxQuoteLegRecord[]>;
  markQuoteUsedIfActive(input: {
    quoteId: string;
    usedByRef: string;
    at: Date;
  }): Promise<FxQuoteRecord | undefined>;
  expireOldQuotes(now: Date): Promise<void>;
}

export interface FxRatesRepositoryPort {
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

export interface FxQuoteFinancialLinesRepositoryPort {
  replaceQuoteFinancialLines(
    input: {
      quoteId: string;
      financialLines: FxQuoteFinancialLineWriteModel[];
    },
    executor?: FxDbExecutor,
  ): Promise<void>;
  listQuoteFinancialLines(
    quoteId: string,
    executor?: FxDbExecutor,
  ): Promise<FxQuoteFinancialLineWriteModel[]>;
}
