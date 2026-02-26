import { getServerApiClient } from "@/lib/api-client.server";

export interface SerializedSourceRate {
  source: string;
  rateNum: string;
  rateDen: string;
  asOf: string;
  change: number | null;
  changePercent: number | null;
}

export interface SerializedRatePair {
  baseCurrencyCode: string;
  quoteCurrencyCode: string;
  bestRate: SerializedSourceRate;
  rates: SerializedSourceRate[];
}

export interface SerializedSourceStatus {
  source: "cbr" | "investing";
  ttlSeconds: number;
  lastSyncedAt: string | null;
  lastPublishedAt: string | null;
  lastStatus: "idle" | "ok" | "error";
  lastError: string | null;
  expiresAt: string | null;
  isExpired: boolean;
}

export interface CurrencyOption {
  code: string;
  name: string;
}

export async function getRatePairs(): Promise<SerializedRatePair[]> {
  const client = await getServerApiClient();
  const res = await client.v1.fx.rates.pairs.$get();

  if (!res.ok) {
    throw new Error(`Failed to fetch rate pairs: ${res.status}`);
  }

  const payload = await res.json();
  return payload.data as SerializedRatePair[];
}

export async function getRateSources(): Promise<SerializedSourceStatus[]> {
  const client = await getServerApiClient();
  const res = await client.v1.fx.rates.sources.$get();

  if (!res.ok) {
    throw new Error(`Failed to fetch rate sources: ${res.status}`);
  }

  const payload = await res.json();
  return payload.data as SerializedSourceStatus[];
}

export async function getCurrencyOptions(): Promise<CurrencyOption[]> {
  const client = await getServerApiClient();
  const res = await client.v1.currencies.$get({
    query: { limit: 100, offset: 0 } as Record<string, unknown>,
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch currencies: ${res.status}`);
  }

  const payload = (await res.json()) as {
    data: { code: string; name: string }[];
  };

  return payload.data.map((c) => ({ code: c.code, name: c.name }));
}
