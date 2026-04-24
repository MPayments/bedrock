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

// Module-scoped cache: the currency catalog is small, static, and queried
// by many components (route editor on every step, create-step dialog,
// operations list). One in-flight Promise serves every concurrent caller
// and subsequent calls hit the resolved array without network roundtrips.
let cachedOptions: CurrencyOption[] | null = null;
let inFlight: Promise<CurrencyOption[]> | null = null;

export async function listCurrencyOptions(): Promise<CurrencyOption[]> {
  if (cachedOptions) return cachedOptions;
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const response = await fetch(
        "/v1/currencies?limit=100&offset=0&sortBy=code&sortOrder=asc",
        { credentials: "include" },
      );
      if (!response.ok) return [];
      const payload = (await response.json()) as CurrenciesResponse;
      const options = payload.data.map((row) => ({
        id: row.id,
        code: row.code,
      }));
      cachedOptions = options;
      return options;
    } catch {
      return [];
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}
