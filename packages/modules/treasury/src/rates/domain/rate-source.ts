export const TREASURY_RATE_SOURCES = ["cbr", "investing", "xe"] as const;

export type RateSource = (typeof TREASURY_RATE_SOURCES)[number];

export type RateSourceSyncStatus = "idle" | "ok" | "error";
