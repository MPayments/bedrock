import { describe, expect, it, vi } from "vitest";

const tlsClientMocks = vi.hoisted(() => {
    return {
        get: vi.fn(),
        destroySession: vi.fn(async () => undefined),
        terminate: vi.fn(async () => undefined),
    };
});

vi.mock("tlsclientwrapper", () => {
    class ModuleClient {
        terminate = tlsClientMocks.terminate;
    }

    class SessionClient {
        get = tlsClientMocks.get;
        destroySession = tlsClientMocks.destroySession;
    }

    return { ModuleClient, SessionClient };
});

import {
    createGrinexRateSourceProvider,
    RateSourceSyncError,
} from "@bedrock/treasury/providers";

function makeCandle(time: number, close: number) {
    return {
        close,
        high: close,
        low: close,
        open: close,
        time,
        volume: 0,
    };
}

describe("createGrinexRateSourceProvider", () => {
    it("creates and disposes owned session when external session is not provided", async () => {
        tlsClientMocks.get.mockReset();
        tlsClientMocks.destroySession.mockClear();
        tlsClientMocks.terminate.mockClear();

        const body = JSON.stringify([makeCandle(1764000000, 80.57)]);
        tlsClientMocks.get.mockResolvedValue({
            status: 200,
            headers: { "content-type": "application/json" },
            body,
        });

        const provider = createGrinexRateSourceProvider({
            maxRetries: 1,
        });

        const result = await provider.fetchLatest();

        expect(result.source).toBe("grinex");
        expect(tlsClientMocks.get).toHaveBeenCalledTimes(1);
        expect(tlsClientMocks.destroySession).toHaveBeenCalledTimes(1);
        expect(tlsClientMocks.terminate).toHaveBeenCalledTimes(1);
    });

    it("emits every candle as USDT/RUB + RUB/USDT rates and picks max asOf as publishedAt", async () => {
        const session = {
            get: vi.fn(async () => ({
                status: 200,
                headers: { "content-type": "application/json" },
                json: [
                    makeCandle(1764000000, 80.57),
                    makeCandle(1764000060, 81.0),
                    makeCandle(1763999940, 80.3),
                ],
                getText: () => "",
            })),
        };

        const provider = createGrinexRateSourceProvider({
            session,
            maxRetries: 1,
        });

        const fetchedAt = new Date("2026-04-07T12:00:00.000Z");
        const result = await provider.fetchLatest(fetchedAt);

        expect(session.get).toHaveBeenCalledTimes(1);
        expect(result.source).toBe("grinex");
        expect(result.fetchedAt.toISOString()).toBe(fetchedAt.toISOString());
        expect(result.publishedAt.getTime()).toBe(1764000060 * 1000);
        expect(result.rates).toHaveLength(6);

        const usdtRubRates = result.rates.filter(
            (rate) => rate.base === "USDT" && rate.quote === "RUB",
        );
        const rubUsdtRates = result.rates.filter(
            (rate) => rate.base === "RUB" && rate.quote === "USDT",
        );
        expect(usdtRubRates).toHaveLength(3);
        expect(rubUsdtRates).toHaveLength(3);

        const latestUsdtRub = usdtRubRates.find(
            (rate) => rate.asOf.getTime() === 1764000060 * 1000,
        );
        expect(latestUsdtRub).toBeTruthy();
        expect(latestUsdtRub!.rateNum).toBe(81n);
        expect(latestUsdtRub!.rateDen).toBe(1n);

        const latestRubUsdt = rubUsdtRates.find(
            (rate) => rate.asOf.getTime() === 1764000060 * 1000,
        );
        expect(latestRubUsdt!.rateNum).toBe(1n);
        expect(latestRubUsdt!.rateDen).toBe(81n);
    });

    it("parses fractional close values into reduced fractions", async () => {
        const session = {
            get: vi.fn(async () => ({
                status: 200,
                headers: { "content-type": "application/json" },
                json: [makeCandle(1764000000, 80.57)],
                getText: () => "",
            })),
        };

        const provider = createGrinexRateSourceProvider({
            session,
            maxRetries: 1,
        });

        const result = await provider.fetchLatest();
        const usdtRub = result.rates.find(
            (rate) => rate.base === "USDT" && rate.quote === "RUB",
        );

        expect(usdtRub).toBeTruthy();
        expect(usdtRub!.rateNum).toBe(8057n);
        expect(usdtRub!.rateDen).toBe(100n);
    });

    it("retries on transient failures and succeeds on the second attempt", async () => {
        const session = {
            get: vi
                .fn()
                .mockRejectedValueOnce(new Error("temporary network glitch"))
                .mockResolvedValueOnce({
                    status: 200,
                    headers: { "content-type": "application/json" },
                    json: [makeCandle(1764000000, 82.5)],
                    getText: () => "",
                }),
        };

        const provider = createGrinexRateSourceProvider({
            session,
            maxRetries: 2,
        });

        const result = await provider.fetchLatest();

        expect(session.get).toHaveBeenCalledTimes(2);
        const usdtRub = result.rates.find(
            (rate) => rate.base === "USDT" && rate.quote === "RUB",
        );
        expect(usdtRub!.rateNum).toBe(165n);
        expect(usdtRub!.rateDen).toBe(2n);
    });

    it("retries with a wider time window when the narrow window returns empty", async () => {
        const session = {
            get: vi
                .fn()
                .mockResolvedValueOnce({
                    status: 200,
                    headers: { "content-type": "application/json" },
                    json: [],
                    getText: () => "",
                })
                .mockResolvedValueOnce({
                    status: 200,
                    headers: { "content-type": "application/json" },
                    json: [makeCandle(1763000000, 79.88)],
                    getText: () => "",
                }),
        };

        const provider = createGrinexRateSourceProvider({
            session,
            maxRetries: 1,
        });

        const result = await provider.fetchLatest();

        expect(session.get).toHaveBeenCalledTimes(2);
        const firstUrl = session.get.mock.calls[0]![0] as string;
        const secondUrl = session.get.mock.calls[1]![0] as string;
        const firstFrom = Number(new URL(firstUrl).searchParams.get("time_from"));
        const secondFrom = Number(new URL(secondUrl).searchParams.get("time_from"));
        expect(secondFrom).toBeLessThan(firstFrom);

        expect(result.rates).toHaveLength(2);
        expect(result.rates[0]!.base).toBe("USDT");
    });

    it("throws when both the narrow and the wide window return empty arrays", async () => {
        const session = {
            get: vi.fn(async () => ({
                status: 200,
                headers: { "content-type": "application/json" },
                json: [],
                getText: () => "",
            })),
        };

        const provider = createGrinexRateSourceProvider({
            session,
            maxRetries: 1,
        });

        await expect(provider.fetchLatest()).rejects.toThrow(RateSourceSyncError);
    });

    it("fails on non-2xx HTTP response", async () => {
        const session = {
            get: vi.fn(async () => ({
                status: 500,
                headers: {},
                json: undefined,
                getText: () => "server error",
            })),
        };

        const provider = createGrinexRateSourceProvider({
            session,
            maxRetries: 1,
        });

        await expect(provider.fetchLatest()).rejects.toThrow(RateSourceSyncError);
    });

    it("fails on invalid JSON body when response.json is undefined", async () => {
        const session = {
            get: vi.fn(async () => ({
                status: 200,
                headers: {},
                json: undefined,
                getText: () => "not-json",
            })),
        };

        const provider = createGrinexRateSourceProvider({
            session,
            maxRetries: 1,
        });

        await expect(provider.fetchLatest()).rejects.toThrow(RateSourceSyncError);
    });

    it("fails when the response body is empty", async () => {
        const session = {
            get: vi.fn(async () => ({
                status: 200,
                headers: {},
                json: undefined,
                getText: () => "   ",
            })),
        };

        const provider = createGrinexRateSourceProvider({
            session,
            maxRetries: 1,
        });

        await expect(provider.fetchLatest()).rejects.toThrow(RateSourceSyncError);
    });

    it("fails when the payload is not an array", async () => {
        const session = {
            get: vi.fn(async () => ({
                status: 200,
                headers: {},
                json: { error: "bad" },
                getText: () => "",
            })),
        };

        const provider = createGrinexRateSourceProvider({
            session,
            maxRetries: 1,
        });

        await expect(provider.fetchLatest()).rejects.toThrow(RateSourceSyncError);
    });

    it("rejects implausible rate values", async () => {
        const zeroSession = {
            get: vi.fn(async () => ({
                status: 200,
                headers: {},
                json: [makeCandle(1764000000, 0)],
                getText: () => "",
            })),
        };

        const hugeSession = {
            get: vi.fn(async () => ({
                status: 200,
                headers: {},
                json: [makeCandle(1764000000, 10_001)],
                getText: () => "",
            })),
        };

        const zeroProvider = createGrinexRateSourceProvider({
            session: zeroSession,
            maxRetries: 1,
        });
        const hugeProvider = createGrinexRateSourceProvider({
            session: hugeSession,
            maxRetries: 1,
        });

        await expect(zeroProvider.fetchLatest()).rejects.toThrow(RateSourceSyncError);
        await expect(hugeProvider.fetchLatest()).rejects.toThrow(RateSourceSyncError);
    });

    it("skips candles with invalid data and keeps all valid ones", async () => {
        const session = {
            get: vi.fn(async () => ({
                status: 200,
                headers: {},
                json: [
                    { time: "bad", close: 80 },
                    makeCandle(1764000000, 80.1),
                    { time: 1764000060, close: "not-a-number" },
                    makeCandle(1763999940, 79.9),
                ],
                getText: () => "",
            })),
        };

        const provider = createGrinexRateSourceProvider({
            session,
            maxRetries: 1,
        });

        const result = await provider.fetchLatest();
        const usdtRubRates = result.rates.filter(
            (rate) => rate.base === "USDT" && rate.quote === "RUB",
        );

        expect(result.rates).toHaveLength(4);
        expect(usdtRubRates).toHaveLength(2);
        expect(usdtRubRates.map((rate) => rate.asOf.getTime())).toEqual([
            1764000000 * 1000,
            1763999940 * 1000,
        ]);
        expect(result.publishedAt.getTime()).toBe(1764000000 * 1000);
    });

    it("does not dispose an externally injected session", async () => {
        const externalClose = vi.fn();
        const session = {
            get: vi.fn(async () => ({
                status: 200,
                headers: {},
                json: [makeCandle(1764000000, 81)],
                getText: () => "",
            })),
            close: externalClose,
        };

        const provider = createGrinexRateSourceProvider({
            session,
            maxRetries: 1,
        });

        await provider.fetchLatest();

        expect(externalClose).not.toHaveBeenCalled();
    });
});
