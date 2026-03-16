export const FX_RATE_SOURCES = ["cbr", "investing", "xe"] as const;

export type FxRateSource = (typeof FX_RATE_SOURCES)[number];

export const FX_RATE_SOURCE_SYNC_STATUSES = ["idle", "ok", "error"] as const;

export type FxRateSourceSyncStatus =
  (typeof FX_RATE_SOURCE_SYNC_STATUSES)[number];
