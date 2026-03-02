import { describe, expect, it, vi } from "vitest";

import { schema } from "@bedrock/db/schema/fx";

import { RateSourceStaleError } from "../../src/fx/errors";
import { createFxService } from "../../src/fx/service";

function createCurrenciesService() {
    const byCode = new Map([
        ["USD", { id: "cur-usd", code: "USD" }],
        ["EUR", { id: "cur-eur", code: "EUR" }],
        ["RUB", { id: "cur-rub", code: "RUB" }],
    ]);

    return {
        findByCode: vi.fn(async (code: string) => {
            const normalized = code.trim().toUpperCase();
            const currency = byCode.get(normalized);
            if (!currency) throw new Error(`Unknown currency code: ${normalized}`);
            return currency;
        }),
        findById: vi.fn(async (id: string) => {
            const entry = [...byCode.values()].find((currency) => currency.id === id);
            if (!entry) throw new Error(`Unknown currency id: ${id}`);
            return entry;
        }),
    };
}

function createNoopFeesService() {
    return {
        calculateFxQuoteFeeComponents: vi.fn(async () => []),
        saveQuoteFeeComponents: vi.fn(async () => undefined),
        getQuoteFeeComponents: vi.fn(async () => []),
    } as any;
}

function createSelectChain(limitImpl: () => Promise<any[]>) {
    return {
        from: vi.fn(() => ({
            where: vi.fn(() => ({
                limit: vi.fn(limitImpl),
                orderBy: vi.fn(limitImpl),
            })),
        })),
    };
}

describe("FX rates priority + TTL", () => {
    it("prefers manual rate over source rate", async () => {
        const provider = {
            source: "cbr" as const,
            fetchLatest: vi.fn(),
        };

        const db = {
            select: vi.fn(() => createSelectChain(async () => [{
                source: "manual",
                rateNum: 101n,
                rateDen: 100n,
                asOf: new Date("2026-02-19T00:00:00Z"),
            }])),
            insert: vi.fn(),
            execute: vi.fn(),
        } as any;

        const service = createFxService({
            db,
            feesService: createNoopFeesService(),
            currenciesService: createCurrenciesService(),
            rateSourceProviders: { cbr: provider },
        });

        const rate = await service.getLatestRate("usd", "eur", new Date("2026-02-19T10:00:00Z"));

        expect(rate.source).toBe("manual");
        expect(provider.fetchLatest).not.toHaveBeenCalled();
    });

    it("refreshes CBR when TTL is expired", async () => {
        const provider = {
            source: "cbr" as const,
            fetchLatest: vi.fn(async () => ({
                source: "cbr" as const,
                fetchedAt: new Date("2026-02-19T10:00:00Z"),
                publishedAt: new Date("2026-02-19T00:00:00Z"),
                rates: [
                    {
                        base: "USD",
                        quote: "RUB",
                        rateNum: 90n,
                        rateDen: 1n,
                        asOf: new Date("2026-02-19T00:00:00Z"),
                    },
                    {
                        base: "RUB",
                        quote: "USD",
                        rateNum: 1n,
                        rateDen: 90n,
                        asOf: new Date("2026-02-19T00:00:00Z"),
                    },
                ],
            })),
        };

        let fxRatesCall = 0;
        let sourceStatus = {
            source: "cbr" as const,
            ttlSeconds: 86400,
            lastSyncedAt: new Date("2026-02-17T00:00:00Z"),
            lastPublishedAt: new Date("2026-02-17T00:00:00Z"),
            lastStatus: "ok" as const,
            lastError: null as string | null,
            updatedAt: new Date("2026-02-17T00:00:00Z"),
        };

        const db = {
            select: vi.fn(() => ({
                from: vi.fn((table: unknown) => ({
                    where: vi.fn(() => ({
                        limit: vi.fn(async () => {
                            if (table === schema.fxRateSources) {
                                return [sourceStatus];
                            }

                            if (table === schema.fxRates) {
                                fxRatesCall += 1;
                                if (fxRatesCall === 1) return [];
                                return [{
                                    source: "cbr",
                                    rateNum: 73n,
                                    rateDen: 1n,
                                    asOf: new Date("2026-02-19T00:00:00Z"),
                                }];
                            }

                            return [];
                        }),
                        orderBy: vi.fn(async () => {
                            if (table === schema.fxRates) {
                                fxRatesCall += 1;
                                if (fxRatesCall === 1) return [];
                                return [{
                                    source: "cbr",
                                    rateNum: 73n,
                                    rateDen: 1n,
                                    asOf: new Date("2026-02-19T00:00:00Z"),
                                }];
                            }

                            return [];
                        }),
                    })),
                    orderBy: vi.fn(async () => [sourceStatus]),
                })),
            })),
            insert: vi.fn((table: unknown) => {
                if (table === schema.fxRates) {
                    return {
                        values: vi.fn(() => ({
                            onConflictDoUpdate: vi.fn(async () => undefined),
                        })),
                    };
                }

                if (table === schema.fxRateSources) {
                    return {
                        values: vi.fn((value: any) => ({
                            onConflictDoUpdate: vi.fn(async () => {
                                sourceStatus = {
                                    ...sourceStatus,
                                    ...value,
                                    source: "cbr",
                                };
                            }),
                            onConflictDoNothing: vi.fn(() => ({
                                returning: vi.fn(async () => []),
                            })),
                        })),
                        onConflictDoNothing: vi.fn(() => ({
                            returning: vi.fn(async () => []),
                        })),
                    };
                }

                throw new Error("unexpected table");
            }),
            execute: vi.fn(),
        } as any;

        const service = createFxService({
            db,
            feesService: createNoopFeesService(),
            currenciesService: createCurrenciesService(),
            rateSourceProviders: { cbr: provider },
        });

        const rate = await service.getLatestRate("USD", "RUB", new Date("2026-02-19T10:00:00Z"));

        expect(rate.source).toBe("cbr");
        expect(provider.fetchLatest).toHaveBeenCalledTimes(1);
    });

    it("throws stale error when TTL expired and CBR sync fails", async () => {
        const provider = {
            source: "cbr" as const,
            fetchLatest: vi.fn(async () => {
                throw new Error("cbr unavailable");
            }),
        };

        const sourceStatus = {
            source: "cbr" as const,
            ttlSeconds: 86400,
            lastSyncedAt: new Date("2026-02-17T00:00:00Z"),
            lastPublishedAt: new Date("2026-02-17T00:00:00Z"),
            lastStatus: "ok" as const,
            lastError: null as string | null,
            updatedAt: new Date("2026-02-17T00:00:00Z"),
        };

        const db = {
            select: vi.fn(() => ({
                from: vi.fn((table: unknown) => ({
                    where: vi.fn(() => ({
                        limit: vi.fn(async () => {
                            if (table === schema.fxRateSources) {
                                return [sourceStatus];
                            }
                            return [];
                        }),
                        orderBy: vi.fn(async () => []),
                    })),
                })),
            })),
            insert: vi.fn((table: unknown) => {
                if (table === schema.fxRateSources) {
                    return {
                        values: vi.fn(() => ({
                            onConflictDoUpdate: vi.fn(async () => undefined),
                            onConflictDoNothing: vi.fn(() => ({
                                returning: vi.fn(async () => []),
                            })),
                        })),
                    };
                }

                if (table === schema.fxRates) {
                    return {
                        values: vi.fn(() => ({
                            onConflictDoUpdate: vi.fn(async () => undefined),
                        })),
                    };
                }

                throw new Error("unexpected table");
            }),
            execute: vi.fn(),
        } as any;

        const service = createFxService({
            db,
            feesService: createNoopFeesService(),
            currenciesService: createCurrenciesService(),
            rateSourceProviders: { cbr: provider },
        });

        await expect(service.getLatestRate("USD", "RUB", new Date("2026-02-19T10:00:00Z"))).rejects.toThrow(RateSourceStaleError);
    });

    it("uses investing when cbr has no matching pair", async () => {
        const now = new Date();
        const minuteAgo = new Date(now.getTime() - 60_000);

        const cbrProvider = {
            source: "cbr" as const,
            fetchLatest: vi.fn(),
        };
        const investingProvider = {
            source: "investing" as const,
            fetchLatest: vi.fn(),
        };

        const freshStatus = {
            ttlSeconds: 86400,
            lastSyncedAt: minuteAgo,
            lastPublishedAt: minuteAgo,
            lastStatus: "ok" as const,
            lastError: null as string | null,
            updatedAt: minuteAgo,
        };
        const freshInvestingStatus = {
            ttlSeconds: 300,
            lastSyncedAt: minuteAgo,
            lastPublishedAt: minuteAgo,
            lastStatus: "ok" as const,
            lastError: null as string | null,
            updatedAt: minuteAgo,
        };

        let fxRatesOrderByCall = 0;
        let sourceLimitCall = 0;

        const db = {
            select: vi.fn(() => ({
                from: vi.fn((table: unknown) => ({
                    where: vi.fn(() => ({
                        limit: vi.fn(async () => {
                            if (table === schema.fxRateSources) {
                                sourceLimitCall += 1;
                                if (sourceLimitCall === 1) return [{ ...freshStatus, source: "cbr" }];
                                if (sourceLimitCall === 2) return [{ ...freshInvestingStatus, source: "investing" }];
                                return [];
                            }
                            return [];
                        }),
                        orderBy: vi.fn(async () => {
                            if (table !== schema.fxRates) return [];
                            fxRatesOrderByCall += 1;

                            if (fxRatesOrderByCall === 1) {
                                // Manual rates lookup
                                return [];
                            }
                            if (fxRatesOrderByCall === 2) {
                                // CBR source lookup
                                return [];
                            }
                            // Investing source lookup
                            return [{
                                source: "investing",
                                rateNum: 91n,
                                rateDen: 1n,
                                asOf: new Date("2026-02-19T00:00:00Z"),
                            }];
                        }),
                    })),
                    orderBy: vi.fn(async () => [
                        { ...freshStatus, source: "cbr" },
                        { ...freshStatus, source: "investing", ttlSeconds: 300 },
                    ]),
                })),
            })),
            insert: vi.fn(() => ({
                values: vi.fn(() => ({
                    onConflictDoNothing: vi.fn(() => ({
                        returning: vi.fn(async () => []),
                    })),
                })),
            })),
            execute: vi.fn(),
        } as any;

        const service = createFxService({
            db,
            feesService: createNoopFeesService(),
            currenciesService: createCurrenciesService(),
            rateSourceProviders: {
                cbr: cbrProvider,
                investing: investingProvider,
            },
        });

        const rate = await service.getLatestRate("USD", "RUB", now);

        expect(rate.source).toBe("investing");
        expect(rate.rateNum).toBe(91n);
        expect(cbrProvider.fetchLatest).not.toHaveBeenCalled();
        expect(investingProvider.fetchLatest).not.toHaveBeenCalled();
    });

    it("expires old active quotes", async () => {
        const db = {
            select: vi.fn(),
            insert: vi.fn(),
            execute: vi.fn(async () => undefined),
        } as any;

        const service = createFxService({
            db,
            feesService: createNoopFeesService(),
            currenciesService: createCurrenciesService(),
            rateSourceProviders: {
                cbr: { source: "cbr", fetchLatest: vi.fn() },
                investing: { source: "investing", fetchLatest: vi.fn() },
            },
        });

        await service.expireOldQuotes(new Date("2026-02-19T10:00:00Z"));

        expect(db.execute).toHaveBeenCalledTimes(1);
    });
});
