import { describe, expect, it, vi } from "vitest";

import { RateSourceSyncError } from "../src/errors";
import { createInvestingRateSourceProvider } from "../src/sources/investing";

describe("createInvestingRateSourceProvider", () => {
    it("parses numeric candle values from response.json", async () => {
        const session = {
            get: vi.fn(async () => ({
                status: 200,
                headers: { "content-type": "application/json" },
                json: {
                    data: [
                        [1771444680000, 76.754, 76.754, 76.751, 76.751, 0, 0],
                    ],
                },
                getText: () => "",
            })),
        };

        const provider = createInvestingRateSourceProvider({
            session,
            pairMappings: [
                { pairId: "2186", base: "USD", quote: "RUB" },
            ],
        });

        const result = await provider.fetchLatest(new Date("2026-02-19T09:00:00.000Z"));
        const usdRub = result.rates.find((rate) => rate.base === "USD" && rate.quote === "RUB");

        expect(usdRub).toBeTruthy();
        expect(usdRub!.rateNum).toBe(76751n);
        expect(usdRub!.rateDen).toBe(1000n);
        expect(result.publishedAt.toISOString()).toBe("2026-02-18T19:58:00.000Z");
    });

    it("parses chart payload and emits direct + inverse rates", async () => {
        const session = {
            get: vi.fn(async () => ({
                status: 200,
                headers: { "content-type": "application/json" },
                json: {
                    data: [
                        [1708300740000, "89.9", "90.0", "89.8", "89.95"],
                        [1708300800000, "90.1", "90.2", "90.0", "90.5"],
                    ],
                },
                getText: () => "",
            })),
        };

        const provider = createInvestingRateSourceProvider({
            session,
            pairMappings: [
                { pairId: "2186", base: "USD", quote: "RUB" },
            ],
        });

        const fetchedAt = new Date("2026-02-19T09:00:00.000Z");
        const result = await provider.fetchLatest(fetchedAt);

        expect(session.get).toHaveBeenCalledTimes(1);
        expect(result.source).toBe("investing");
        expect(result.fetchedAt.toISOString()).toBe(fetchedAt.toISOString());
        expect(result.publishedAt.toISOString()).toBe("2024-02-19T00:00:00.000Z");
        expect(result.rates).toHaveLength(2);

        const usdRub = result.rates.find((rate) => rate.base === "USD" && rate.quote === "RUB");
        const rubUsd = result.rates.find((rate) => rate.base === "RUB" && rate.quote === "USD");

        expect(usdRub).toBeTruthy();
        expect(rubUsd).toBeTruthy();
        expect(usdRub!.rateNum).toBe(181n);
        expect(usdRub!.rateDen).toBe(2n);
        expect(usdRub!.rateNum * rubUsd!.rateNum).toBe(usdRub!.rateDen * rubUsd!.rateDen);
    });

    it("retries pair fetch and supports text-json fallback", async () => {
        const session = {
            get: vi
                .fn()
                .mockRejectedValueOnce(new Error("temporary"))
                .mockResolvedValueOnce({
                    status: 200,
                    headers: { "content-type": "application/json" },
                    json: undefined,
                    getText: () => JSON.stringify({
                        data: [
                            [1708300800000, 90.0, 90.0, 90.0, 90.25],
                        ],
                    }),
                }),
        };

        const provider = createInvestingRateSourceProvider({
            session,
            maxRetries: 2,
            pairMappings: [
                { pairId: "2186", base: "USD", quote: "RUB" },
            ],
        });

        const result = await provider.fetchLatest(new Date("2026-02-19T09:00:00.000Z"));

        expect(session.get).toHaveBeenCalledTimes(2);
        const usdRub = result.rates.find((rate) => rate.base === "USD" && rate.quote === "RUB");
        expect(usdRub).toBeTruthy();
        expect(usdRub!.rateNum).toBe(361n);
        expect(usdRub!.rateDen).toBe(4n);
    });

    it("returns partial success when at least one pair is available", async () => {
        const session = {
            get: vi.fn(async (url: string) => {
                if (url.includes("/1/")) {
                    throw new Error("first pair failed");
                }

                return {
                    status: 200,
                    headers: { "content-type": "application/json" },
                    json: {
                        data: [
                            [1708300800000, "90", "90", "90", "90"],
                        ],
                    },
                    getText: () => "",
                };
            }),
        };

        const provider = createInvestingRateSourceProvider({
            session,
            maxRetries: 1,
            pairMappings: [
                { pairId: "1", base: "EUR", quote: "USD" },
                { pairId: "2186", base: "USD", quote: "RUB" },
            ],
        });

        const result = await provider.fetchLatest(new Date("2026-02-19T09:00:00.000Z"));

        expect(session.get).toHaveBeenCalledTimes(2);
        expect(result.rates).toHaveLength(2);
        expect(result.rates[0]!.base).toBe("USD");
    });

    it("throws when no pair returned parseable data", async () => {
        const session = {
            get: vi.fn(async () => ({
                status: 200,
                headers: { "content-type": "application/json" },
                json: { data: [] },
                getText: () => "",
            })),
        };

        const provider = createInvestingRateSourceProvider({
            session,
            pairMappings: [
                { pairId: "2186", base: "USD", quote: "RUB" },
            ],
        });

        await expect(provider.fetchLatest()).rejects.toThrow(RateSourceSyncError);
    });
});
