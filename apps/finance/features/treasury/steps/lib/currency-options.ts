"use client";

/**
 * Client-side fetcher for the `/v1/currencies` endpoint.
 *
 * Returns the currency catalog in a minimal `{id, code}` shape consumed by
 * the standalone-step create dialog. Errors resolve to an empty list so the
 * dialog still renders (with a disabled Select) rather than crashing.
 */
export interface CurrencyOption {
  id: string;
  code: string;
}

interface CurrenciesResponse {
  data: Array<{ id: string; code: string }>;
  limit?: number;
  offset?: number;
  total?: number;
}

export async function listCurrencyOptions(): Promise<CurrencyOption[]> {
  try {
    const response = await fetch(
      "/v1/currencies?limit=100&offset=0&sortBy=code&sortOrder=asc",
      { credentials: "include" },
    );
    if (!response.ok) return [];
    const payload = (await response.json()) as CurrenciesResponse;
    return payload.data.map((row) => ({ id: row.id, code: row.code }));
  } catch {
    return [];
  }
}
