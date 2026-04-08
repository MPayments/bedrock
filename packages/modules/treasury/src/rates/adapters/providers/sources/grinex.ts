import {
  ModuleClient,
  SessionClient,
  type TlsClientResponse,
} from "tlsclientwrapper";

import { parseDecimalToFraction } from "@bedrock/shared/money/math";

import { getRootCauseMessage, RateSourceSyncError } from "./errors";
import { type RateSourceFetchResult, type RateSourceProvider } from "./types";

/**
 * Grinex provider: fetches USDT/A7A5 minute candles (A7A5 is a RUB-pegged
 * stablecoin) and stores rates under base=USDT, quote=RUB under the
 * zero-spread assumption that 1 A7A5 == 1 RUB. We use usdta7a5 rather than
 * usdtrub because it has materially better liquidity on Grinex.
 *
 * Grinex applies a 307 redirect + cookie challenge on first request.
 * tlsclientwrapper's default cookie jar + followRedirects handles this
 * transparently in a single session.get() call.
 */

interface GrinexCandle {
  close: number;
  high: number;
  low: number;
  open: number;
  time: number;
  volume: number;
}

interface GrinexResponse {
  status: number;
  headers: Record<string, string>;
  json?: unknown;
  getText: () => string | Promise<string>;
}

interface GrinexSession {
  get(
    url: string,
    options?: {
      headers?: Record<string, string>;
      timeoutSeconds?: number;
      followRedirects?: boolean;
    },
  ): Promise<GrinexResponse>;
  close?: () => Promise<void> | void;
}

interface SessionScope {
  session: GrinexSession;
  dispose: () => Promise<void>;
}

export interface GrinexRateSourceProviderDeps {
  session?: GrinexSession;
  createSession?: () => GrinexSession;
  maxRetries?: number;
  timeoutSeconds?: number;
  headers?: Record<string, string>;
  windowSeconds?: number;
  wideWindowSeconds?: number;
  bufferSeconds?: number;
  periodMinutes?: number;
}

const GRINEX_API_BASE = "https://grinex.io/api/v2";

const GRINEX_MARKET_MAPPING = {
  market: "usdta7a5",
  base: "USDT",
  quote: "RUB",
} as const;

const DEFAULT_PERIOD_MINUTES = 1;
const DEFAULT_WINDOW_SECONDS = 7200; // 2h minute candles
const DEFAULT_WIDE_WINDOW_SECONDS = 86_400; // 24h fallback
const DEFAULT_BUFFER_SECONDS = 60;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_TIMEOUT_SECONDS = 30;
const MIN_PLAUSIBLE_RATE = 0;
const MAX_PLAUSIBLE_RATE = 10_000;

const DEFAULT_HEADERS: Record<string, string> = {
  Accept: "application/json, text/plain, */*",
  "Accept-Encoding": "identity",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
  Referer: "https://grinex.io/",
  Origin: "https://grinex.io",
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "same-origin",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
};

export function createGrinexRateSourceProvider(
  deps: GrinexRateSourceProviderDeps = {},
): RateSourceProvider {
  const sessionFactory = deps.createSession ?? createSession;
  const maxRetries = deps.maxRetries ?? DEFAULT_MAX_RETRIES;
  const timeoutSeconds = deps.timeoutSeconds ?? DEFAULT_TIMEOUT_SECONDS;
  const windowSeconds = deps.windowSeconds ?? DEFAULT_WINDOW_SECONDS;
  const wideWindowSeconds =
    deps.wideWindowSeconds ?? DEFAULT_WIDE_WINDOW_SECONDS;
  const bufferSeconds = deps.bufferSeconds ?? DEFAULT_BUFFER_SECONDS;
  const periodMinutes = deps.periodMinutes ?? DEFAULT_PERIOD_MINUTES;
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

    try {
      let candles = await fetchCandlesWithRetry({
        session: scope.session,
        periodMinutes,
        windowSeconds,
        bufferSeconds,
        now,
        maxRetries,
        timeoutSeconds,
        headers,
      });

      if (candles.length === 0) {
        candles = await fetchCandlesWithRetry({
          session: scope.session,
          periodMinutes,
          windowSeconds: wideWindowSeconds,
          bufferSeconds,
          now,
          maxRetries,
          timeoutSeconds,
          headers,
        });
      }

      if (candles.length === 0) {
        throw new RateSourceSyncError(
          "grinex",
          `empty candles for market ${GRINEX_MARKET_MAPPING.market} (${GRINEX_MARKET_MAPPING.base}/${GRINEX_MARKET_MAPPING.quote})`,
        );
      }

      const rates = extractRatesFromCandles(candles);
      if (rates.length === 0) {
        throw new RateSourceSyncError(
          "grinex",
          `no parseable candles for market ${GRINEX_MARKET_MAPPING.market}`,
        );
      }

      let publishedAt = rates[0]!.asOf;
      for (const rate of rates) {
        if (rate.asOf.getTime() > publishedAt.getTime()) {
          publishedAt = rate.asOf;
        }
      }

      return {
        source: "grinex",
        fetchedAt: now,
        publishedAt,
        rates,
      };
    } finally {
      await scope.dispose();
    }
  }

  return {
    source: "grinex",
    fetchLatest,
  };
}

function createSession(): GrinexSession {
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
        followRedirects: options.followRedirects,
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

function createExternalSessionScope(session: GrinexSession): SessionScope {
  return {
    session,
    dispose: async () => {},
  };
}

function createOwnedSessionScope(session: GrinexSession): SessionScope {
  return {
    session,
    dispose: async () => {
      if (session.close === undefined) return;
      await session.close();
    },
  };
}

async function fetchCandlesWithRetry(input: {
  session: GrinexSession;
  periodMinutes: number;
  windowSeconds: number;
  bufferSeconds: number;
  now: Date;
  maxRetries: number;
  timeoutSeconds: number;
  headers: Record<string, string>;
}): Promise<GrinexCandle[]> {
  const { maxRetries } = input;

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fetchCandles(input);
    } catch (error) {
      lastError = error;
    }
  }

  const rootCause =
    getRootCauseMessage(lastError) ??
    (lastError instanceof Error ? lastError.message : undefined);
  const detail = rootCause ? `: ${rootCause}` : "";

  throw new RateSourceSyncError(
    "grinex",
    `all retries failed for market ${GRINEX_MARKET_MAPPING.market}${detail}`,
    lastError,
  );
}

async function fetchCandles(input: {
  session: GrinexSession;
  periodMinutes: number;
  windowSeconds: number;
  bufferSeconds: number;
  now: Date;
  timeoutSeconds: number;
  headers: Record<string, string>;
}): Promise<GrinexCandle[]> {
  const {
    session,
    periodMinutes,
    windowSeconds,
    bufferSeconds,
    now,
    timeoutSeconds,
    headers,
  } = input;

  const nowSeconds = Math.floor(now.getTime() / 1000);
  const timeFrom = nowSeconds - windowSeconds;
  const timeTo = nowSeconds + bufferSeconds;
  const url = buildUrl(
    GRINEX_MARKET_MAPPING.market,
    periodMinutes,
    timeFrom,
    timeTo,
  );

  let response: GrinexResponse;
  try {
    response = await session.get(url, {
      headers,
      timeoutSeconds,
      followRedirects: true,
    });
  } catch (error) {
    throw new RateSourceSyncError(
      "grinex",
      `request failed for market ${GRINEX_MARKET_MAPPING.market}`,
      error,
    );
  }

  if (response.status < 200 || response.status >= 300) {
    const body = await response.getText();
    const bodySuffix = body?.trim() ? ` (${body.trim().slice(0, 200)})` : "";
    throw new RateSourceSyncError(
      "grinex",
      `HTTP ${response.status} for market ${GRINEX_MARKET_MAPPING.market}${bodySuffix}`,
    );
  }

  const payload = await parsePayload(response);
  return extractCandles(payload);
}

function buildUrl(
  market: string,
  periodMinutes: number,
  timeFrom: number,
  timeTo: number,
) {
  const query = new URLSearchParams({
    market,
    period: String(periodMinutes),
    time_from: String(timeFrom),
    time_to: String(timeTo),
  });

  return `${GRINEX_API_BASE}/k?${query.toString()}`;
}

async function parsePayload(response: GrinexResponse): Promise<unknown> {
  if (response.json !== undefined) {
    return response.json;
  }

  const rawText = await response.getText();
  if (!rawText || !rawText.trim()) {
    throw new RateSourceSyncError(
      "grinex",
      `empty response body for market ${GRINEX_MARKET_MAPPING.market}`,
    );
  }

  try {
    return JSON.parse(rawText);
  } catch (error) {
    throw new RateSourceSyncError(
      "grinex",
      `invalid JSON payload for market ${GRINEX_MARKET_MAPPING.market}`,
      error,
    );
  }
}

function extractCandles(payload: unknown): GrinexCandle[] {
  if (!Array.isArray(payload)) {
    throw new RateSourceSyncError(
      "grinex",
      `unexpected payload shape for market ${GRINEX_MARKET_MAPPING.market}`,
    );
  }

  const candles: GrinexCandle[] = [];
  for (const entry of payload) {
    const candle = toCandle(entry);
    if (candle) {
      candles.push(candle);
    }
  }
  return candles;
}

function toCandle(value: unknown): GrinexCandle | null {
  if (!isRecord(value)) return null;

  const time = Number(value.time);
  const close = Number(value.close);
  if (!Number.isFinite(time) || time <= 0) return null;
  if (!Number.isFinite(close) || close <= 0) return null;

  return {
    close,
    high: Number(value.high),
    low: Number(value.low),
    open: Number(value.open),
    time,
    volume: Number(value.volume),
  };
}

function extractRatesFromCandles(
  candles: GrinexCandle[],
): RateSourceFetchResult["rates"] {
  const rates: RateSourceFetchResult["rates"] = [];

  for (const candle of candles) {
    try {
      validateClose(candle.close);
      const fraction = parseDecimalToFraction(String(candle.close), {
        allowScientific: false,
      });
      const asOf = new Date(candle.time * 1000);

      rates.push({
        base: GRINEX_MARKET_MAPPING.base,
        quote: GRINEX_MARKET_MAPPING.quote,
        rateNum: fraction.num,
        rateDen: fraction.den,
        asOf,
      });
      rates.push({
        base: GRINEX_MARKET_MAPPING.quote,
        quote: GRINEX_MARKET_MAPPING.base,
        rateNum: fraction.den,
        rateDen: fraction.num,
        asOf,
      });
    } catch {
      continue;
    }
  }

  return rates;
}

function validateClose(close: number): void {
  if (close <= MIN_PLAUSIBLE_RATE || close >= MAX_PLAUSIBLE_RATE) {
    throw new RateSourceSyncError(
      "grinex",
      `implausible rate value ${close} for market ${GRINEX_MARKET_MAPPING.market}`,
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function mapTlsClientResponse(response: TlsClientResponse): GrinexResponse {
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
