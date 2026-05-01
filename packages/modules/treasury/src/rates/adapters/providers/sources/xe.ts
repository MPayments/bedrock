import {
  ModuleClient,
  SessionClient,
  type TlsClientResponse,
} from "tlsclientwrapper";

import { parseDecimalToFraction } from "@bedrock/shared/money/math";

import { getRootCauseMessage, RateSourceSyncError } from "./errors";
import {
  type RateSourceFetchResult,
  type RateSourceProvider,
} from "./types";

interface PairMapping {
  base: string;
  quote: string;
}

interface XeResponse {
  status: number;
  headers: Record<string, string>;
  getText: () => string | Promise<string>;
}

interface XeSession {
  get(
    url: string,
    options?: {
      headers?: Record<string, string>;
      timeoutSeconds?: number;
      allowRedirects?: boolean;
    },
  ): Promise<XeResponse>;
  close?: () => Promise<void> | void;
}

interface SessionScope {
  session: XeSession;
  dispose: () => Promise<void>;
}

export interface XeRateSourceProviderDeps {
  session?: XeSession;
  createSession?: () => XeSession;
  pairMappings?: PairMapping[];
  maxRetries?: number;
  timeoutSeconds?: number;
  headers?: Record<string, string>;
}

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_TIMEOUT_SECONDS = 30;
const XE_CONVERTER_BASE = "https://www.xe.com/currencyconverter/convert/";

const DEFAULT_HEADERS: Record<string, string> = {
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Encoding": "identity",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
  "sec-fetch-dest": "document",
  "sec-fetch-mode": "navigate",
  "sec-fetch-site": "none",
  "sec-fetch-user": "?1",
  "Upgrade-Insecure-Requests": "1",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
};

const DEFAULT_PAIR_MAPPINGS: PairMapping[] = [
  { base: "EUR", quote: "USD" },
  { base: "EUR", quote: "AED" },
  { base: "EUR", quote: "RUB" },
  { base: "EUR", quote: "CNY" },
  { base: "EUR", quote: "TRY" },
  { base: "USD", quote: "AED" },
  { base: "USD", quote: "RUB" },
  { base: "USD", quote: "CNY" },
  { base: "USD", quote: "TRY" },
  { base: "USD", quote: "IDR" },
  { base: "USD", quote: "KRW" },
  { base: "AED", quote: "RUB" },
  { base: "RUB", quote: "KRW" },
  { base: "RUB", quote: "IDR" },
];

export function createXeRateSourceProvider(
  deps: XeRateSourceProviderDeps = {},
): RateSourceProvider {
  const sessionFactory = deps.createSession ?? createSession;
  const pairMappings = deps.pairMappings ?? DEFAULT_PAIR_MAPPINGS;
  const maxRetries = deps.maxRetries ?? DEFAULT_MAX_RETRIES;
  const timeoutSeconds = deps.timeoutSeconds ?? DEFAULT_TIMEOUT_SECONDS;
  const headers = {
    ...DEFAULT_HEADERS,
    ...deps.headers,
  };

  async function fetchLatest(
    now = new Date(),
  ): Promise<RateSourceFetchResult> {
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
          const pairRate = await fetchPairRateWithRetry({
            session: scope.session,
            mapping,
            maxRetries,
            timeoutSeconds,
            headers,
            now,
          });

          if (
            latestPublishedAt === undefined ||
            pairRate.publishedAt.getTime() > latestPublishedAt.getTime()
          ) {
            latestPublishedAt = pairRate.publishedAt;
          }

          rates.push({
            base: mapping.base,
            quote: mapping.quote,
            rateNum: pairRate.fraction.num,
            rateDen: pairRate.fraction.den,
            asOf: pairRate.publishedAt,
          });
          rates.push({
            base: mapping.quote,
            quote: mapping.base,
            rateNum: pairRate.fraction.den,
            rateDen: pairRate.fraction.num,
            asOf: pairRate.publishedAt,
          });
        } catch (error) {
          lastError = error;
          pairErrors.push(
            `${mapping.base}/${mapping.quote}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      if (latestPublishedAt === undefined) {
        throw new RateSourceSyncError(
          "xe",
          `provider returned no parseable rates (${pairErrors.join("; ")})`,
          lastError,
        );
      }

      return {
        source: "xe",
        fetchedAt: now,
        publishedAt: latestPublishedAt,
        rates,
      };
    } finally {
      await scope.dispose();
    }
  }

  return {
    source: "xe",
    fetchLatest,
  };
}

function createSession(): XeSession {
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

function createExternalSessionScope(session: XeSession): SessionScope {
  return {
    session,
    dispose: async () => {},
  };
}

function createOwnedSessionScope(session: XeSession): SessionScope {
  return {
    session,
    dispose: async () => {
      if (session.close === undefined) return;
      await session.close();
    },
  };
}

async function fetchPairRateWithRetry(input: {
  session: XeSession;
  mapping: PairMapping;
  maxRetries: number;
  timeoutSeconds: number;
  headers: Record<string, string>;
  now: Date;
}) {
  const { maxRetries } = input;

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fetchPairRate(input);
    } catch (error) {
      lastError = error;
    }
  }

  const rootCause =
    getRootCauseMessage(lastError) ??
    (lastError instanceof Error ? lastError.message : undefined);
  const detail = rootCause ? `: ${rootCause}` : "";

  throw new RateSourceSyncError(
    "xe",
    `all retries failed for pair ${input.mapping.base}/${input.mapping.quote}${detail}`,
    lastError,
  );
}

async function fetchPairRate(input: {
  session: XeSession;
  mapping: PairMapping;
  timeoutSeconds: number;
  headers: Record<string, string>;
  now: Date;
}) {
  const { session, mapping, timeoutSeconds, headers, now } = input;
  const pairKey = `${mapping.base}/${mapping.quote}`;
  const url = buildConverterUrl(mapping.base, mapping.quote);

  let response: XeResponse;
  try {
    response = await session.get(url, {
      headers,
      timeoutSeconds,
      allowRedirects: true,
    });
  } catch (error) {
    throw new RateSourceSyncError(
      "xe",
      `request failed for pair ${pairKey}`,
      error,
    );
  }

  if (response.status < 200 || response.status >= 300) {
    const body = response.status === 0 ? await response.getText() : undefined;
    const bodySuffix = body?.trim() ? ` (${body.trim().slice(0, 200)})` : "";
    throw new RateSourceSyncError(
      "xe",
      `HTTP ${response.status} for pair ${pairKey}${bodySuffix}`,
    );
  }

  const html = await response.getText();
  if (!html || !html.trim()) {
    throw new RateSourceSyncError("xe", `empty response body for pair ${pairKey}`);
  }

  const rate = parseRateFromHtml(html, mapping.base, mapping.quote);
  const publishedAt = parseTimestampFromHtml(html, now);
  const fraction = parseDecimalToFraction(rate, { allowScientific: false });

  return {
    publishedAt,
    fraction,
  };
}

function buildConverterUrl(base: string, quote: string) {
  const query = new URLSearchParams({
    Amount: "1",
    From: base,
    To: quote,
  });

  return `${XE_CONVERTER_BASE}?${query.toString()}`;
}

interface NextDataResult {
  rates: Record<string, number>;
  timestamp: number;
}

function extractNextData(html: string): NextDataResult | null {
  const scriptMatch = /<script\s+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i.exec(html);
  if (!scriptMatch?.[1]) return null;

  try {
    const data = JSON.parse(scriptMatch[1]);
    const ratesData = data?.props?.pageProps?.initialRatesData;
    if (!ratesData?.rates || typeof ratesData.timestamp !== "number") return null;

    return { rates: ratesData.rates, timestamp: ratesData.timestamp };
  } catch {
    return null;
  }
}

/**
 * Extracts rate from xe.com HTML.
 *
 * Tries __NEXT_DATA__ JSON first (structured), then falls back to the
 * displayed text pattern "1.00 BASE = X.XXXXXXXX QUOTE".
 */
export function parseRateFromHtml(
  html: string,
  base: string,
  quote: string,
): string {
  const fromNextData = parseRateFromNextData(html, base, quote);
  if (fromNextData) return fromNextData;

  const fromText = parseRateFromText(html, base, quote);
  if (fromText) return fromText;

  throw new RateSourceSyncError(
    "xe",
    `cannot parse rate from HTML for ${base}/${quote}`,
  );
}

function parseRateFromNextData(
  html: string,
  base: string,
  quote: string,
): string | null {
  const nextData = extractNextData(html);
  if (!nextData) return null;

  const rates = nextData.rates;
  const baseRate = rates[base.toUpperCase()];
  const quoteRate = rates[quote.toUpperCase()];

  if (typeof baseRate !== "number" || typeof quoteRate !== "number") return null;
  if (!Number.isFinite(baseRate) || !Number.isFinite(quoteRate)) return null;
  if (baseRate <= 0 || quoteRate <= 0) return null;

  const rate = quoteRate / baseRate;
  return String(rate);
}

/**
 * Matches patterns like:
 *   "1.00 USD = 0.84783018 EUR"
 *   "1 USD = 0.84783018 EUR"
 */
export function parseRateFromText(
  html: string,
  base: string,
  quote: string,
): string | null {
  const escaped = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `1(?:\\.0+)?\\s*${escaped(base)}\\s*=\\s*(\\d+(?:\\.\\d+)?)\\s*${escaped(quote)}`,
    "i",
  );

  const match = pattern.exec(html);
  if (!match?.[1]) return null;

  const value = match[1];
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;

  return value;
}

/**
 * Parses timestamp from __NEXT_DATA__ `initialRatesData.timestamp` (ms),
 * then falls back to "Mid-market rate at HH:MM UTC" text, then to `now`.
 */
export function parseTimestampFromHtml(html: string, now: Date): Date {
  const nextData = extractNextData(html);
  if (nextData) {
    const date = new Date(nextData.timestamp);
    if (!Number.isNaN(date.getTime()) && date.getTime() > 0) return date;
  }

  return parseTimestampFromText(html, now);
}

function parseTimestampFromText(html: string, now: Date): Date {
  const match = /Mid-market rate at (\d{1,2}):(\d{2}) UTC/i.exec(html);
  if (!match?.[1] || !match[2]) return now;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return now;

  const date = new Date(now);
  date.setUTCHours(hours, minutes, 0, 0);

  if (date.getTime() > now.getTime()) {
    date.setUTCDate(date.getUTCDate() - 1);
  }

  return date;
}

function mapTlsClientResponse(response: TlsClientResponse): XeResponse {
  return {
    status: response.status,
    headers: response.headers,
    getText: () => response.body,
  };
}
