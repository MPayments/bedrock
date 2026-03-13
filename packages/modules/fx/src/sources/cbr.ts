import * as soap from "soap";

import {
  parseDecimalToFraction,
  parsePositiveInt,
  reduceFraction,
} from "@bedrock/kernel/math";

import { RateSourceSyncError } from "../errors";
import {
  type FxRateSourceFetchResult,
  type FxRateSourceProvider,
} from "./types";

const DEFAULT_BASE_URL = "https://www.cbr.ru/DailyInfoWebServ/DailyInfo.asmx";

type SoapMethodResponse = [unknown, string?, unknown?, string?];
type UnknownRecord = Record<string, unknown>;

interface CbrSoapClient {
  GetLatestDateTimeAsync(
    args: Record<string, never>,
  ): Promise<SoapMethodResponse>;
  GetCursOnDateAsync: (args: {
    On_date: string;
  }) => Promise<SoapMethodResponse>;
}

interface CbrRateSourceProviderDeps {
  baseUrl?: string;
  soapClientFactory?: (wsdlUrl: string) => Promise<CbrSoapClient>;
}

export function createCbrRateSourceProvider(
  deps: CbrRateSourceProviderDeps = {},
): FxRateSourceProvider {
  const baseUrl = deps.baseUrl ?? DEFAULT_BASE_URL;
  const soapClientFactory = deps.soapClientFactory ?? createSoapClient;

  async function fetchLatest(
    now = new Date(),
  ): Promise<FxRateSourceFetchResult> {
    const client = await soapClientFactory(`${baseUrl}?wsdl`);
    const publishedAt = await fetchPublishedAt(client);
    const payload = await fetchRatesPayload(client, publishedAt);
    const rates = parseRates(payload, publishedAt);

    return {
      source: "cbr",
      fetchedAt: now,
      publishedAt,
      rates,
    };
  }

  return {
    source: "cbr",
    fetchLatest,
  };
}

async function createSoapClient(wsdlUrl: string) {
  return (await soap.createClientAsync(wsdlUrl)) as unknown as CbrSoapClient;
}

async function fetchPublishedAt(client: CbrSoapClient) {
  let payload: unknown;
  let rawResponse: string | undefined;
  try {
    const response = await client.GetLatestDateTimeAsync({});
    payload = response[0];
    rawResponse = response[1];
  } catch (error) {
    throw new RateSourceSyncError(
      "cbr",
      "request GetLatestDateTime failed",
      error,
    );
  }

  const rawDate = extractLatestDateValue(payload, rawResponse);
  const publishedAt = parseCbrDateTime(rawDate);
  if (Number.isNaN(publishedAt.getTime())) {
    throw new RateSourceSyncError(
      "cbr",
      `invalid latest date value: ${rawDate}`,
    );
  }
  return publishedAt;
}

async function fetchRatesPayload(client: CbrSoapClient, publishedAt: Date) {
  try {
    const response = await client.GetCursOnDateAsync({
      On_date: formatCbrDateTime(publishedAt),
    });
    return response[0];
  } catch (error) {
    throw new RateSourceSyncError("cbr", "request GetCursOnDate failed", error);
  }
}

function extractLatestDateValue(payload: unknown, rawResponse?: string) {
  // Prefer raw SOAP XML to avoid timezone shifts introduced by XML->Date coercion.
  if (typeof rawResponse === "string" && rawResponse.trim().length > 0) {
    const fromXml = extractLatestDateFromRawXml(rawResponse);
    if (fromXml) {
      return fromXml;
    }
  }

  if (typeof payload === "string") {
    const text = payload.trim();
    if (text.length > 0) return text;
  }

  if (isRecord(payload)) {
    const value = asText(getValue(payload, "GetLatestDateTimeResult"));
    if (value) {
      return value;
    }
  }

  throw new RateSourceSyncError(
    "cbr",
    "cannot parse latest date from SOAP payload",
  );
}

function extractLatestDateFromRawXml(xml: string): string | null {
  const match =
    /<[^>]*GetLatestDateTimeResult[^>]*>([^<]+)<\/[^>]*GetLatestDateTimeResult>/i.exec(
      xml,
    );
  if (!match?.[1]) {
    return null;
  }

  const value = match[1].trim();
  return value.length ? value : null;
}

function parseRates(payload: unknown, publishedAt: Date) {
  const rows = extractRateRows(payload);
  const rates: FxRateSourceFetchResult["rates"] = [];

  for (const row of rows) {
    const code = normalizeCode(getField(row, "VchCode"));
    if (!code || code === "RUB") continue;

    const unitRate = parseUnitRate(row);
    if (!unitRate) continue;

    rates.push({
      base: code,
      quote: "RUB",
      rateNum: unitRate.num,
      rateDen: unitRate.den,
      asOf: publishedAt,
    });
    rates.push({
      base: "RUB",
      quote: code,
      rateNum: unitRate.den,
      rateDen: unitRate.num,
      asOf: publishedAt,
    });
  }

  if (!rates.length) {
    throw new RateSourceSyncError(
      "cbr",
      "no parseable rates in GetCursOnDate response",
    );
  }

  return rates;
}

function extractRateRows(payload: unknown) {
  const root = expectRecord(payload, "invalid GetCursOnDate SOAP payload");
  const result = asRecord(getValue(root, "GetCursOnDateResult")) ?? root;
  const diffgram = asRecord(getValue(result, "diffgram")) ?? result;
  const dataset =
    asRecord(getValue(diffgram, "NewDataSet")) ??
    asRecord(getValue(diffgram, "ValuteData")) ??
    diffgram;

  const rows = toRecordArray(getValue(dataset, "ValuteCursOnDate"));
  if (!rows.length) {
    throw new RateSourceSyncError(
      "cbr",
      "no currency rows in GetCursOnDate response",
    );
  }

  return rows;
}

function getField(row: UnknownRecord, fieldName: string) {
  return asText(getValue(row, fieldName));
}

function getValue(row: UnknownRecord, fieldName: string) {
  if (fieldName in row) {
    return row[fieldName];
  }

  const expected = fieldName.toLowerCase();
  for (const [key, value] of Object.entries(row)) {
    if (localName(key) === expected) {
      return value;
    }
  }

  return undefined;
}

function asText(value: unknown): string | null {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized.length ? normalized : null;
  }

  if (typeof value === "number" || typeof value === "bigint") {
    return String(value);
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = asText(item);
      if (nested) return nested;
    }
    return null;
  }

  if (isRecord(value)) {
    for (const nested of Object.values(value)) {
      const text = asText(nested);
      if (text) return text;
    }
  }

  return null;
}

function toRecordArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter(isRecord);
  }
  if (isRecord(value)) {
    return [value];
  }
  return [];
}

function asRecord(value: unknown) {
  return isRecord(value) ? value : null;
}

function expectRecord(value: unknown, message: string) {
  if (!isRecord(value)) {
    throw new RateSourceSyncError("cbr", message);
  }
  return value;
}

function parseUnitRate(row: UnknownRecord) {
  const vunitRate = getField(row, "VunitRate");
  if (vunitRate) {
    return parseDecimalToFraction(vunitRate, { allowScientific: true });
  }

  const vcursRaw = getField(row, "Vcurs");
  const vnomRaw = getField(row, "Vnom");
  if (!vcursRaw || !vnomRaw) return null;

  const vcurs = parseDecimalToFraction(vcursRaw, { allowScientific: true });
  const nominal = parsePositiveInt(vnomRaw);
  if (!nominal) return null;

  return reduceFraction(vcurs.num, vcurs.den * nominal);
}

function parseCbrDateTime(input: string) {
  const normalized = input.trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(normalized)) {
    return new Date(`${normalized}Z`);
  }
  return new Date(normalized);
}

function formatCbrDateTime(date: Date) {
  const year = String(date.getUTCFullYear());
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  const seconds = String(date.getUTCSeconds()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

function localName(value: string) {
  const index = value.indexOf(":");
  return (index >= 0 ? value.slice(index + 1) : value).toLowerCase();
}

function normalizeCode(input: string | null) {
  if (!input) return null;
  const normalized = input.trim().toUpperCase();
  return normalized.length ? normalized : null;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}
