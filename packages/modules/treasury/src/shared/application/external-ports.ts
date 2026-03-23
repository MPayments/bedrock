import type {
  CalculateQuoteFeeComponentsInput,
  FeeComponent,
} from "../../fees/application/contracts";
import type {
  RateSource,
  RateSourceSyncStatus,
} from "../../rates/domain/rate-source";

export type {
  RateSource,
  RateSourceSyncStatus,
} from "../../rates/domain/rate-source";

export interface CurrencyRecord {
  id: string;
  code: string;
}

export interface CurrenciesPort {
  findByCode(code: string): Promise<CurrencyRecord>;
  findById(id: string): Promise<CurrencyRecord>;
}

export interface QuoteFeesPort {
  calculateQuoteFeeComponents(
    input: CalculateQuoteFeeComponentsInput,
  ): Promise<FeeComponent[]>;
}

export interface RateSourceStatus {
  source: RateSource;
  ttlSeconds: number;
  lastSyncedAt: Date | null;
  lastPublishedAt: Date | null;
  lastStatus: RateSourceSyncStatus;
  lastError: string | null;
  expiresAt: Date | null;
  isExpired: boolean;
}

export interface RateRecord {
  base: string;
  quote: string;
  rateNum: bigint;
  rateDen: bigint;
  asOf: Date;
}

export interface RateSourceFetchResult {
  source: RateSource;
  fetchedAt: Date;
  publishedAt: Date;
  rates: RateRecord[];
}

export interface RateSourceProvider {
  source: RateSource;
  fetchLatest(now?: Date): Promise<RateSourceFetchResult>;
}

export interface RateSourceSyncResult {
  source: RateSource;
  synced: boolean;
  rateCount: number;
  publishedAt: Date | null;
  status: RateSourceStatus;
}
