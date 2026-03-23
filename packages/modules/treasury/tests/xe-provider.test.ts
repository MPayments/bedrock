import { describe, expect, it, vi } from "vitest";

import {
  createXeRateSourceProvider,
  RateSourceSyncError,
} from "@bedrock/treasury/providers";

import {
  parseRateFromHtml,
  parseRateFromText,
  parseTimestampFromHtml,
} from "../src/rates/adapters/providers/sources/xe";

function makeHtml(rate: string, base: string, quote: string, time = "13:39") {
    return `
        <html><body>
        <p>1.00 ${base} = ${rate} ${quote}</p>
        <p>Mid-market rate at ${time} UTC</p>
        </body></html>
    `;
}

function makeNextDataJson(rates: Record<string, number>, timestampMs: number) {
    return JSON.stringify({
        props: {
            pageProps: {
                initialRatesData: { timestamp: timestampMs, rates },
            },
        },
    });
}

function makeFullHtml(opts: {
    rates: Record<string, number>;
    timestampMs: number;
    base: string;
    quote: string;
    textRate: string;
    time?: string;
}) {
    const nextDataJson = makeNextDataJson(opts.rates, opts.timestampMs);
    return `
        <html><body>
        <script id="__NEXT_DATA__" type="application/json">${nextDataJson}</script>
        <p>1.00 ${opts.base} = ${opts.textRate} ${opts.quote}</p>
        <p>Mid-market rate at ${opts.time ?? "13:39"} UTC</p>
        </body></html>
    `;
}

function makeSession(responses: Record<string, { status: number; body: string }>) {
    return {
        get: vi.fn(async (url: string) => {
            for (const [key, value] of Object.entries(responses)) {
                if (url.includes(key)) {
                    return {
                        status: value.status,
                        headers: { "content-type": "text/html" },
                        getText: () => value.body,
                    };
                }
            }

            return {
                status: 200,
                headers: { "content-type": "text/html" },
                getText: () => responses[Object.keys(responses)[0]!]!.body,
            };
        }),
    };
}

describe("parseRateFromText", () => {
    it("extracts rate from standard format", () => {
        const html = `<p>1.00 USD = 0.84783018 EUR</p>`;
        expect(parseRateFromText(html, "USD", "EUR")).toBe("0.84783018");
    });

    it("extracts rate without decimal in '1'", () => {
        const html = `<p>1 USD = 0.84783018 EUR</p>`;
        expect(parseRateFromText(html, "USD", "EUR")).toBe("0.84783018");
    });

    it("extracts integer rate", () => {
        const html = `<p>1.00 USD = 155 JPY</p>`;
        expect(parseRateFromText(html, "USD", "JPY")).toBe("155");
    });

    it("returns null when rate is not found", () => {
        const html = `<p>No rate here</p>`;
        expect(parseRateFromText(html, "USD", "EUR")).toBeNull();
    });

    it("is case-insensitive for currency codes", () => {
        const html = `<p>1.00 usd = 0.847 eur</p>`;
        expect(parseRateFromText(html, "USD", "EUR")).toBe("0.847");
    });
});

describe("parseTimestampFromHtml", () => {
    const now = new Date("2026-02-27T14:00:00.000Z");

    it("parses timestamp from __NEXT_DATA__ initialRatesData", () => {
        const ts = new Date("2026-02-27T13:43:00.000Z").getTime();
        const html = `
            <script id="__NEXT_DATA__" type="application/json">
                ${makeNextDataJson({ USD: 1 }, ts)}
            </script>
            <p>Mid-market rate at 13:39 UTC</p>
        `;
        const result = parseTimestampFromHtml(html, now);
        expect(result.toISOString()).toBe("2026-02-27T13:43:00.000Z");
    });

    it("falls back to text timestamp when __NEXT_DATA__ is absent", () => {
        const html = `<p>Mid-market rate at 13:39 UTC</p>`;
        const result = parseTimestampFromHtml(html, now);
        expect(result.getUTCHours()).toBe(13);
        expect(result.getUTCMinutes()).toBe(39);
    });

    it("falls back to now when no timestamp found anywhere", () => {
        const html = `<p>No timestamp here</p>`;
        const result = parseTimestampFromHtml(html, now);
        expect(result.toISOString()).toBe(now.toISOString());
    });

    it("rolls back to previous day if text time is in the future", () => {
        const earlyNow = new Date("2026-02-27T02:00:00.000Z");
        const html = `<p>Mid-market rate at 23:30 UTC</p>`;
        const result = parseTimestampFromHtml(html, earlyNow);
        expect(result.getUTCDate()).toBe(26);
        expect(result.getUTCHours()).toBe(23);
        expect(result.getUTCMinutes()).toBe(30);
    });
});

describe("parseRateFromHtml", () => {
    it("parses rate from text when __NEXT_DATA__ is absent", () => {
        const html = makeHtml("0.84783018", "USD", "EUR");
        expect(parseRateFromHtml(html, "USD", "EUR")).toBe("0.84783018");
    });

    it("parses rate from __NEXT_DATA__ initialRatesData when available", () => {
        const html = makeFullHtml({
            rates: { USD: 1, EUR: 0.84783 },
            timestampMs: 1772458980000,
            base: "USD",
            quote: "EUR",
            textRate: "0.84783018",
        });
        expect(parseRateFromHtml(html, "USD", "EUR")).toBe("0.84783");
    });

    it("computes cross-rate from initialRatesData for non-USD pairs", () => {
        const html = makeFullHtml({
            rates: { USD: 1, EUR: 0.85, RUB: 90 },
            timestampMs: 1772458980000,
            base: "EUR",
            quote: "RUB",
            textRate: "105.88",
        });
        const result = parseRateFromHtml(html, "EUR", "RUB");
        const parsed = Number(result);
        expect(parsed).toBeCloseTo(90 / 0.85, 8);
    });

    it("falls back to text when __NEXT_DATA__ has no initialRatesData", () => {
        const html = `
            <script id="__NEXT_DATA__" type="application/json">
                {"props":{"pageProps":{"something":"else"}}}
            </script>
            <p>1.00 USD = 0.84783018 EUR</p>
        `;
        expect(parseRateFromHtml(html, "USD", "EUR")).toBe("0.84783018");
    });

    it("falls back to text when currency is missing from rates dict", () => {
        const html = makeFullHtml({
            rates: { USD: 1, EUR: 0.85 },
            timestampMs: 1772458980000,
            base: "USD",
            quote: "XYZ",
            textRate: "42.5",
        });
        expect(parseRateFromHtml(html, "USD", "XYZ")).toBe("42.5");
    });

    it("throws when rate cannot be parsed at all", () => {
        const html = `<html><body><p>Nothing useful here</p></body></html>`;
        expect(() => parseRateFromHtml(html, "USD", "EUR")).toThrow(RateSourceSyncError);
    });
});

describe("createXeRateSourceProvider", () => {
    it("parses rate from HTML and emits direct + inverse rates", async () => {
        const session = makeSession({
            "From=USD&To=EUR": {
                status: 200,
                body: makeHtml("0.84783018", "USD", "EUR", "13:39"),
            },
        });

        const provider = createXeRateSourceProvider({
            session,
            pairMappings: [{ base: "USD", quote: "EUR" }],
        });

        const fetchedAt = new Date("2026-02-27T14:00:00.000Z");
        const result = await provider.fetchLatest(fetchedAt);

        expect(session.get).toHaveBeenCalledTimes(1);
        expect(result.source).toBe("xe");
        expect(result.fetchedAt.toISOString()).toBe(fetchedAt.toISOString());
        expect(result.rates).toHaveLength(2);

        const usdEur = result.rates.find((r) => r.base === "USD" && r.quote === "EUR");
        const eurUsd = result.rates.find((r) => r.base === "EUR" && r.quote === "USD");

        expect(usdEur).toBeTruthy();
        expect(eurUsd).toBeTruthy();

        // 0.84783018 = 84783018 / 100000000 -> simplified
        expect(usdEur!.rateNum).toBeGreaterThan(0n);
        expect(usdEur!.rateDen).toBeGreaterThan(0n);

        // Direct * Inverse = 1 (num*num == den*den)
        expect(usdEur!.rateNum * eurUsd!.rateNum).toBe(usdEur!.rateDen * eurUsd!.rateDen);
    });

    it("retries pair fetch on transient failure", async () => {
        const session = {
            get: vi
                .fn()
                .mockRejectedValueOnce(new Error("temporary"))
                .mockResolvedValueOnce({
                    status: 200,
                    headers: { "content-type": "text/html" },
                    getText: () => makeHtml("90.5", "USD", "RUB", "10:00"),
                }),
        };

        const provider = createXeRateSourceProvider({
            session,
            maxRetries: 2,
            pairMappings: [{ base: "USD", quote: "RUB" }],
        });

        const result = await provider.fetchLatest(new Date("2026-02-27T14:00:00.000Z"));

        expect(session.get).toHaveBeenCalledTimes(2);
        const usdRub = result.rates.find((r) => r.base === "USD" && r.quote === "RUB");
        expect(usdRub).toBeTruthy();
        // 90.5 = 181/2
        expect(usdRub!.rateNum).toBe(181n);
        expect(usdRub!.rateDen).toBe(2n);
    });

    it("returns partial success when at least one pair is available", async () => {
        const session = {
            get: vi.fn(async (url: string) => {
                if (url.includes("From=EUR")) {
                    throw new Error("first pair failed");
                }

                return {
                    status: 200,
                    headers: { "content-type": "text/html" },
                    getText: () => makeHtml("90.0", "USD", "RUB", "12:00"),
                };
            }),
        };

        const provider = createXeRateSourceProvider({
            session,
            maxRetries: 1,
            pairMappings: [
                { base: "EUR", quote: "USD" },
                { base: "USD", quote: "RUB" },
            ],
        });

        const result = await provider.fetchLatest(new Date("2026-02-27T14:00:00.000Z"));

        expect(session.get).toHaveBeenCalledTimes(2);
        expect(result.rates).toHaveLength(2);
        expect(result.rates[0]!.base).toBe("USD");
    });

    it("throws when no pair returned parseable data", async () => {
        const session = makeSession({
            default: {
                status: 200,
                body: "<html><body>Nothing</body></html>",
            },
        });

        const provider = createXeRateSourceProvider({
            session,
            maxRetries: 1,
            pairMappings: [{ base: "USD", quote: "RUB" }],
        });

        await expect(provider.fetchLatest()).rejects.toThrow(RateSourceSyncError);
    });

    it("throws on HTTP error after retries", async () => {
        const session = makeSession({
            default: {
                status: 403,
                body: "Forbidden",
            },
        });

        const provider = createXeRateSourceProvider({
            session,
            maxRetries: 1,
            pairMappings: [{ base: "USD", quote: "EUR" }],
        });

        await expect(provider.fetchLatest()).rejects.toThrow(RateSourceSyncError);
    });

    it("parses timestamp from page and attaches to rates", async () => {
        const session = makeSession({
            default: {
                status: 200,
                body: makeHtml("155.814", "USD", "JPY", "06:10"),
            },
        });

        const provider = createXeRateSourceProvider({
            session,
            pairMappings: [{ base: "USD", quote: "JPY" }],
        });

        const now = new Date("2026-02-27T14:00:00.000Z");
        const result = await provider.fetchLatest(now);

        expect(result.publishedAt.getUTCHours()).toBe(6);
        expect(result.publishedAt.getUTCMinutes()).toBe(10);
        expect(result.rates[0]!.asOf.getUTCHours()).toBe(6);
    });

    it("handles integer rates correctly", async () => {
        const session = makeSession({
            default: {
                status: 200,
                body: makeHtml("155", "USD", "JPY", "12:00"),
            },
        });

        const provider = createXeRateSourceProvider({
            session,
            pairMappings: [{ base: "USD", quote: "JPY" }],
        });

        const result = await provider.fetchLatest(new Date("2026-02-27T14:00:00.000Z"));

        const usdJpy = result.rates.find((r) => r.base === "USD" && r.quote === "JPY");
        expect(usdJpy).toBeTruthy();
        expect(usdJpy!.rateNum).toBe(155n);
        expect(usdJpy!.rateDen).toBe(1n);
    });
});
