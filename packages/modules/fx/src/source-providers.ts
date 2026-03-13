import type { FxRateSource } from "./schema";

export type { FxRateSource };

export interface FxRateSourceStatus {
  source: FxRateSource;
  ttlSeconds: number;
  lastSyncedAt: Date | null;
  lastPublishedAt: Date | null;
  lastStatus: "idle" | "ok" | "error";
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
