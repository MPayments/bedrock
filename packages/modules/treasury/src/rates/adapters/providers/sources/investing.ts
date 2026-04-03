import {
  ModuleClient,
  SessionClient,
  type TlsClientResponse,
} from "tlsclientwrapper";

import { parseDecimalToFraction } from "@bedrock/shared/money/math";

import { getRootCauseMessage, RateSourceSyncError } from "./errors";
import { type RateSourceFetchResult, type RateSourceProvider } from "./types";

type Interval = "PT1M";

interface PairMapping {
  pairId: string;
  base: string;
  quote: string;
}

interface InvestingResponse {
  status: number;
  headers: Record<string, string>;
  json?: unknown;
  getText: () => string | Promise<string>;
}

interface InvestingSession {
  get(
    url: string,
    options?: {
      headers?: Record<string, string>;
      timeoutSeconds?: number;
      allowRedirects?: boolean;
    },
  ): Promise<InvestingResponse>;
  close?: () => Promise<void> | void;
}

interface SessionScope {
  session: InvestingSession;
  dispose: () => Promise<void>;
}

export interface InvestingRateSourceProviderDeps {
  session?: InvestingSession;
  createSession?: () => InvestingSession;
  pairMappings?: PairMapping[];
  interval?: Interval;
  points?: number;
  maxRetries?: number;
  timeoutSeconds?: number;
  headers?: Record<string, string>;
}

const DEFAULT_INTERVAL: Interval = "PT1M";
const DEFAULT_POINTS = 60;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_TIMEOUT_SECONDS = 30;
const INVESTING_API_BASE = "https://api.investing.com/api/financialdata";

const DEFAULT_HEADERS: Record<string, string> = {
  Accept: "application/json, text/plain, */*",
  "Accept-Encoding": "identity",
  "Cache-Control": "max-age=0",
  Pragma: "no-cache",
  "domain-id": "www",
  Referer: "https://www.investing.com/",
  Origin: "https://www.investing.com",
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "same-site",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
};

// Curated shortlist aligned with currently supported product currencies.
const DEFAULT_PAIR_MAPPINGS: PairMapping[] = [
  { pairId: "1", base: "EUR", quote: "USD" },
  { pairId: "1604", base: "EUR", quote: "AED" },
  { pairId: "1691", base: "EUR", quote: "RUB" },
  { pairId: "1623", base: "EUR", quote: "CNY" },
  { pairId: "66", base: "EUR", quote: "TRY" },
  { pairId: "152", base: "USD", quote: "AED" },
  { pairId: "2186", base: "USD", quote: "RUB" },
  { pairId: "2111", base: "USD", quote: "CNY" },
  { pairId: "18", base: "USD", quote: "TRY" },
  { pairId: "9298", base: "AED", quote: "RUB" },
  { pairId: "9530", base: "CNY", quote: "RUB" },
];

export function createInvestingRateSourceProvider(
  deps: InvestingRateSourceProviderDeps = {},
): RateSourceProvider {
  const sessionFactory = deps.createSession ?? createSession;
  const pairMappings = deps.pairMappings ?? DEFAULT_PAIR_MAPPINGS;
  const interval = deps.interval ?? DEFAULT_INTERVAL;
  const points = deps.points ?? DEFAULT_POINTS;
  const maxRetries = deps.maxRetries ?? DEFAULT_MAX_RETRIES;
  const timeoutSeconds = deps.timeoutSeconds ?? DEFAULT_TIMEOUT_SECONDS;
  const headers = {
    ...DEFAULT_HEADERS,
    ...deps.headers,
  };

  async function fetchLatest(now = new Date()): Promise<RateSourceFetchResult> {
    let scope: SessionScope;
    if (deps.session !== undefined) {
      scope = createExternalSessionScope(deps.session);
    } else {
      scope = createOwnedSessionScope(sessionFactory());
    }

    const rates: RateSourceFetchResult["rates"] = [];
    let latestPublishedAt: Date | undefined;
    let lastError: unknown;
    const pairErrors: string[] = [];

    try {
      for (const mapping of pairMappings) {
        try {
          const pairResult = await fetchPairRatesWithRetry({
            session: scope.session,
            mapping,
            interval,
            points,
            maxRetries,
            timeoutSeconds,
            headers,
          });

          if (
            latestPublishedAt === undefined ||
            pairResult.publishedAt.getTime() > latestPublishedAt.getTime()
          ) {
            latestPublishedAt = pairResult.publishedAt;
          }

          rates.push(...pairResult.rates);
        } catch (error) {
          lastError = error;
          pairErrors.push(
            `${mapping.base}/${mapping.quote}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      if (latestPublishedAt === undefined) {
        throw new RateSourceSyncError(
          "investing",
          `provider returned no parseable rates (${pairErrors.join("; ")})`,
          lastError,
        );
      }

      return {
        source: "investing",
        fetchedAt: now,
        publishedAt: latestPublishedAt,
        rates,
      };
    } finally {
      await scope.dispose();
    }
  }

  return {
    source: "investing",
    fetchLatest,
  };
}

function createSession(): InvestingSession {
  const moduleClient = new ModuleClient();
  const sessionClient = new SessionClient(moduleClient, {
    tlsClientIdentifier: "chrome_131",
    forceHttp1: true,
    retryIsEnabled: false,
  });

  return {
    async get(url, options = {}) {
      const response = await sessionClient.get(url, {
        headers: options.headers,
        timeoutSeconds: options.timeoutSeconds,
        followRedirects: options.allowRedirects,
        retryIsEnabled: false,
      });

      return mapTlsClientResponse(response);
    },
    async close() {
      try {
        await sessionClient.destroySession();
      } finally {
        await moduleClient.terminate();
      }
    },
  };
}

function createExternalSessionScope(session: InvestingSession): SessionScope {
  return {
    session,
    dispose: async () => {},
  };
}

function createOwnedSessionScope(session: InvestingSession): SessionScope {
  return {
    session,
    dispose: async () => {
      if (session.close === undefined) return;
      await session.close();
    },
  };
}

async function fetchPairRatesWithRetry(input: {
  session: InvestingSession;
  mapping: PairMapping;
  interval: Interval;
  points: number;
  maxRetries: number;
  timeoutSeconds: number;
  headers: Record<string, string>;
}) {
  const { maxRetries } = input;

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fetchPairRates(input);
    } catch (error) {
      lastError = error;
    }
  }

  const rootCause =
    getRootCauseMessage(lastError) ??
    (lastError instanceof Error ? lastError.message : undefined);
  const detail = rootCause ? `: ${rootCause}` : "";

  throw new RateSourceSyncError(
    "investing",
    `all retries failed for pair ${input.mapping.base}/${input.mapping.quote}${detail}`,
    lastError,
  );
}

async function fetchPairRates(input: {
  session: InvestingSession;
  mapping: PairMapping;
  interval: Interval;
  points: number;
  timeoutSeconds: number;
  headers: Record<string, string>;
}) {
  const { session, mapping, interval, points, timeoutSeconds, headers } = input;
  const url = buildUrl(mapping.pairId, interval, points);

  let response: InvestingResponse;
  try {
    response = await session.get(url, {
      headers,
      timeoutSeconds,
      allowRedirects: true,
    });
  } catch (error) {
    throw new RateSourceSyncError(
      "investing",
      `request failed for pair ${mapping.base}/${mapping.quote}`,
      error,
    );
  }

  if (response.status < 200 || response.status >= 300) {
    const body = response.status === 0 ? await response.getText() : undefined;
    const bodySuffix = body?.trim() ? ` (${body.trim().slice(0, 200)})` : "";
    throw new RateSourceSyncError(
      "investing",
      `HTTP ${response.status} for pair ${mapping.base}/${mapping.quote}${bodySuffix}`,
    );
  }

  const payload = await parsePayload(
    response,
    `${mapping.base}/${mapping.quote}`,
  );
  const candles = extractCandles(payload, `${mapping.base}/${mapping.quote}`);
  const rates = extractRatesFromCandles(candles, mapping);

  return {
    publishedAt: rates.at(-1)!.asOf,
    rates,
  };
}

function buildUrl(pairId: string, interval: Interval, points: number) {
  const query = new URLSearchParams({
    interval,
    pointscount: String(points),
  });

  return `${INVESTING_API_BASE}/${pairId}/historical/chart/?${query.toString()}`;
}

async function parsePayload(
  response: InvestingResponse,
  pairKey: string,
): Promise<{ data?: unknown[] }> {
  if (
    response.json &&
    isRecord(response.json) &&
    Array.isArray(response.json.data)
  ) {
    return response.json as { data?: unknown[] };
  }

  const rawText = await response.getText();
  if (!rawText || !rawText.trim()) {
    throw new RateSourceSyncError(
      "investing",
      `empty response body for pair ${pairKey}`,
    );
  }

  try {
    return JSON.parse(rawText) as { data?: unknown[] };
  } catch (error) {
    throw new RateSourceSyncError(
      "investing",
      `invalid JSON payload for pair ${pairKey}`,
      error,
    );
  }
}

function extractCandles(payload: { data?: unknown[] }, pairKey: string) {
  if (!Array.isArray(payload.data) || payload.data.length === 0) {
    throw new RateSourceSyncError(
      "investing",
      `empty chart data for pair ${pairKey}`,
    );
  }
  return payload.data;
}

function extractRatesFromCandles(
  candles: unknown[],
  mapping: PairMapping,
): RateSourceFetchResult["rates"] {
  const pairKey = `${mapping.base}/${mapping.quote}`;
  const rates: RateSourceFetchResult["rates"] = [];

  for (const candle of candles) {
    try {
      const publishedAt = extractTimestamp(candle, pairKey);
      const close = extractClosePrice(candle, pairKey);
      const fraction = parseDecimalToFraction(close, {
        allowScientific: false,
      });

      rates.push({
        base: mapping.base,
        quote: mapping.quote,
        rateNum: fraction.num,
        rateDen: fraction.den,
        asOf: publishedAt,
      });
      rates.push({
        base: mapping.quote,
        quote: mapping.base,
        rateNum: fraction.den,
        rateDen: fraction.num,
        asOf: publishedAt,
      });
    } catch {
      continue;
    }
  }

  if (rates.length === 0) {
    throw new RateSourceSyncError(
      "investing",
      `no parseable chart candles for pair ${pairKey}`,
    );
  }

  return rates;
}

function extractTimestamp(candle: unknown, pairKey: string) {
  if (!Array.isArray(candle) || candle.length < 1) {
    throw new RateSourceSyncError(
      "investing",
      `invalid candle shape for pair ${pairKey}`,
    );
  }

  const value = Number(candle[0]);
  if (!Number.isFinite(value) || value <= 0) {
    throw new RateSourceSyncError(
      "investing",
      `invalid candle timestamp for pair ${pairKey}`,
    );
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new RateSourceSyncError(
      "investing",
      `invalid publishedAt for pair ${pairKey}`,
    );
  }
  return date;
}

function extractClosePrice(candle: unknown, pairKey: string) {
  if (!Array.isArray(candle) || candle.length < 5) {
    throw new RateSourceSyncError(
      "investing",
      `invalid candle close for pair ${pairKey}`,
    );
  }

  const close = candle[4];
  if (typeof close === "number") {
    if (!Number.isFinite(close) || close <= 0) {
      throw new RateSourceSyncError(
        "investing",
        `invalid close value for pair ${pairKey}`,
      );
    }
    return String(close);
  }
  if (typeof close === "string") {
    return close;
  }

  throw new RateSourceSyncError(
    "investing",
    `unsupported close type for pair ${pairKey}`,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function mapTlsClientResponse(response: TlsClientResponse): InvestingResponse {
  const rawBody = response.body;
  const parsed = tryParseJson(rawBody);

  return {
    status: response.status,
    headers: response.headers,
    json: parsed,
    getText: () => rawBody,
  };
}

function tryParseJson(input: string): unknown {
  if (!input || !input.trim()) return undefined;

  try {
    return JSON.parse(input);
  } catch {
    return undefined;
  }
}
