import { XMLParser } from "fast-xml-parser";

import { RateSourceSyncError } from "../errors";
import { type FxRateSourceFetchResult, type FxRateSourceProvider } from "./types";

const DEFAULT_BASE_URL = "https://www.cbr.ru/DailyInfoWebServ/DailyInfo.asmx";

const xmlParser = new XMLParser({
    ignoreAttributes: true,
    parseTagValue: false,
    trimValues: true,
});

interface Fraction {
    num: bigint;
    den: bigint;
}

export interface CbrRateSourceProviderDeps {
    fetchFn?: typeof fetch;
    baseUrl?: string;
}

export function createCbrRateSourceProvider(deps: CbrRateSourceProviderDeps = {}): FxRateSourceProvider {
    const baseUrl = deps.baseUrl ?? DEFAULT_BASE_URL;

    async function fetchLatest(now = new Date()): Promise<FxRateSourceFetchResult> {
        const fetchFn = deps.fetchFn ?? globalThis.fetch;
        if (!fetchFn) {
            throw new RateSourceSyncError("cbr", "fetch is not available in this runtime");
        }

        let latestDateResponse: Response;
        try {
            latestDateResponse = await fetchFn(`${baseUrl}/GetLatestDateTime`);
        } catch (error) {
            throw new RateSourceSyncError("cbr", "request GetLatestDateTime failed", error);
        }

        if (!latestDateResponse.ok) {
            throw new RateSourceSyncError("cbr", `GetLatestDateTime failed with status ${latestDateResponse.status}`);
        }

        const latestDateXml = await latestDateResponse.text();
        const publishedAt = parseLatestDateTime(latestDateXml);

        const dateCandidates = [
            formatCbrDate(publishedAt),
            publishedAt.toISOString().slice(0, 10),
        ];

        let lastError: unknown;
        for (const onDate of dateCandidates) {
            try {
                const response = await fetchFn(`${baseUrl}/GetCursOnDateXML?On_date=${encodeURIComponent(onDate)}`);
                if (!response.ok) {
                    throw new RateSourceSyncError("cbr", `GetCursOnDateXML(${onDate}) failed with status ${response.status}`);
                }

                const xml = await response.text();
                const rates = parseRates(xml, publishedAt);

                return {
                    source: "cbr",
                    fetchedAt: now,
                    publishedAt,
                    rates,
                };
            } catch (error) {
                lastError = error;
            }
        }

        throw new RateSourceSyncError("cbr", "all GetCursOnDateXML attempts failed", lastError);
    }

    return {
        source: "cbr",
        fetchLatest,
    };
}

function parseXml(xml: string): unknown {
    try {
        return xmlParser.parse(xml);
    } catch (error) {
        throw new RateSourceSyncError("cbr", "invalid XML response", error);
    }
}

function formatCbrDate(date: Date): string {
    const day = String(date.getUTCDate()).padStart(2, "0");
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const year = String(date.getUTCFullYear());
    return `${day}/${month}/${year}`;
}

function parseLatestDateTime(xml: string): Date {
    const parsed = parseXml(xml);
    const values = collectNodesByLocalName(parsed, "GetLatestDateTimeResult");
    const first = firstStringValue(values[0]);

    if (!first) {
        throw new RateSourceSyncError("cbr", "cannot parse latest date from XML");
    }

    const date = new Date(first);
    if (Number.isNaN(date.getTime())) {
        throw new RateSourceSyncError("cbr", `invalid latest date value: ${first}`);
    }

    return date;
}

function parseRates(xml: string, publishedAt: Date): FxRateSourceFetchResult["rates"] {
    const parsed = parseXml(xml);
    const rowNodes = collectNodesByLocalName(parsed, "ValuteCursOnDate");
    const rows = flattenNodes(rowNodes);

    const rates: FxRateSourceFetchResult["rates"] = [];

    for (const row of rows) {
        const code = normalizeCode(getFieldValue(row, "VchCode"));
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
        throw new RateSourceSyncError("cbr", "no parseable rates in GetCursOnDateXML response");
    }

    return rates;
}

function parseUnitRate(row: unknown): Fraction | null {
    const vunitRate = getFieldValue(row, "VunitRate");
    if (vunitRate) {
        return parseDecimalToFraction(vunitRate);
    }

    const vcursRaw = getFieldValue(row, "Vcurs");
    const vnomRaw = getFieldValue(row, "Vnom");
    if (!vcursRaw || !vnomRaw) {
        return null;
    }

    const vcurs = parseDecimalToFraction(vcursRaw);
    const nominal = parsePositiveInt(vnomRaw);
    if (!nominal) {
        return null;
    }

    return reduceFraction(vcurs.num, vcurs.den * nominal);
}

function getFieldValue(row: unknown, fieldName: string): string | null {
    const values = collectNodesByLocalName(row, fieldName);
    for (const value of values) {
        const text = firstStringValue(value);
        if (text) return text;
    }
    return null;
}

function collectNodesByLocalName(node: unknown, keyName: string): unknown[] {
    const found: unknown[] = [];
    const target = keyName.toLowerCase();

    function visit(value: unknown) {
        if (Array.isArray(value)) {
            for (const item of value) visit(item);
            return;
        }

        if (!isRecord(value)) return;

        for (const [key, child] of Object.entries(value)) {
            if (localName(key) === target) {
                found.push(child);
            } else {
                visit(child);
            }
        }
    }

    visit(node);
    return found;
}

function firstStringValue(value: unknown): string | null {
    if (typeof value === "string") {
        const normalized = value.trim();
        return normalized.length ? normalized : null;
    }

    if (Array.isArray(value)) {
        for (const item of value) {
            const nested = firstStringValue(item);
            if (nested) return nested;
        }
    }

    if (isRecord(value)) {
        for (const nested of Object.values(value)) {
            const text = firstStringValue(nested);
            if (text) return text;
        }
    }

    return null;
}

function flattenNodes(nodes: unknown[]): unknown[] {
    const flattened: unknown[] = [];

    for (const node of nodes) {
        if (Array.isArray(node)) {
            for (const nested of node) {
                flattened.push(nested);
            }
        } else {
            flattened.push(node);
        }
    }

    return flattened;
}

function localName(key: string): string {
    const index = key.indexOf(":");
    return (index >= 0 ? key.slice(index + 1) : key).toLowerCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function normalizeCode(input: string | null): string | null {
    if (!input) return null;
    const normalized = input.trim().toUpperCase();
    return normalized.length ? normalized : null;
}

function parsePositiveInt(input: string): bigint | null {
    const normalized = normalizeNumberString(input);
    if (!isDigits(normalized)) return null;
    const value = BigInt(normalized);
    return value > 0n ? value : null;
}

function parseDecimalToFraction(input: string): Fraction {
    const normalized = normalizeNumberString(input).split(",").join(".");
    if (!isPositiveDecimal(normalized)) {
        throw new RateSourceSyncError("cbr", `invalid decimal number: ${input}`);
    }

    const [intPartRaw, fractionPartRaw = ""] = normalized.split(".");
    const intPart = intPartRaw || "0";
    const fractionPart = fractionPartRaw;
    const den = 10n ** BigInt(fractionPart.length);
    const num = BigInt(intPart + fractionPart);

    if (num <= 0n) {
        throw new RateSourceSyncError("cbr", `decimal must be positive: ${input}`);
    }

    return reduceFraction(num, den);
}

function normalizeNumberString(input: string): string {
    let result = "";

    for (const char of input) {
        if (char === "\u00a0") continue;
        if (char.trim() === "") continue;
        result += char;
    }

    return result.trim();
}

function isDigits(input: string): boolean {
    if (!input.length) return false;

    for (let i = 0; i < input.length; i++) {
        const code = input.charCodeAt(i);
        if (code < 48 || code > 57) return false;
    }

    return true;
}

function isPositiveDecimal(input: string): boolean {
    if (!input.length) return false;

    let dotSeen = false;
    let digitsBeforeDot = 0;
    let digitsAfterDot = 0;

    for (let i = 0; i < input.length; i++) {
        const char = input[i]!;
        if (char === ".") {
            if (dotSeen) return false;
            dotSeen = true;
            continue;
        }

        const code = input.charCodeAt(i);
        if (code < 48 || code > 57) return false;

        if (dotSeen) digitsAfterDot++;
        else digitsBeforeDot++;
    }

    if (digitsBeforeDot === 0) return false;
    if (dotSeen && digitsAfterDot === 0) return false;

    return true;
}

function gcd(a: bigint, b: bigint): bigint {
    let x = a < 0n ? -a : a;
    let y = b < 0n ? -b : b;

    while (y !== 0n) {
        const t = y;
        y = x % y;
        x = t;
    }

    return x;
}

function reduceFraction(num: bigint, den: bigint): Fraction {
    if (num <= 0n || den <= 0n) {
        throw new RateSourceSyncError("cbr", `fraction must be positive: ${num}/${den}`);
    }

    const factor = gcd(num, den);
    return {
        num: num / factor,
        den: den / factor,
    };
}
