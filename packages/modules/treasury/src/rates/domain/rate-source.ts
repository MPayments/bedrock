export const TREASURY_RATE_SOURCES = ["cbr", "investing", "xe"] as const;

export type RateSource = (typeof TREASURY_RATE_SOURCES)[number];

export const TREASURY_RATE_SOURCE_SYNC_STATUSES = ["idle", "ok", "error"] as const;

export type RateSourceSyncStatus =
  (typeof TREASURY_RATE_SOURCE_SYNC_STATUSES)[number];
