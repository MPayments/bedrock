import type {
  CalculateFxQuoteFeeComponentsInput,
  FeeComponent,
  GetQuoteFeeComponentsInput,
  SaveQuoteFeeComponentsInput,
} from "@bedrock/fees/contracts";
import type {
  PersistenceSession,
  RunInPersistenceSession,
} from "@bedrock/shared/core/persistence";

import type {
  FxRateSource,
  FxRateSourceSyncStatus,
} from "../../domain/rate-source";

export type {
  FxRateSource,
  FxRateSourceSyncStatus,
} from "../../domain/rate-source";

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
    tx?: PersistenceSession,
  ): Promise<FeeComponent[]>;
  getQuoteFeeComponents(
    input: GetQuoteFeeComponentsInput,
    tx?: PersistenceSession,
  ): Promise<FeeComponent[]>;
  saveQuoteFeeComponents(
    input: SaveQuoteFeeComponentsInput,
    tx?: PersistenceSession,
  ): Promise<void>;
}

export interface FxTransactionsPort {
  runInTransaction: RunInPersistenceSession;
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
