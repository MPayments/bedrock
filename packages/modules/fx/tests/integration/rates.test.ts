import { and, desc, eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

import { createCurrenciesService } from "@bedrock/currencies";
import { currencyIdForCode } from "@bedrock/db/seeds";
import { schema } from "@bedrock/fx/schema";
import { DAY_IN_SECONDS } from "@bedrock/ledger/constants";

import { db } from "./setup";
import { RateSourceStaleError } from "../../src/errors";
import { createFxService } from "../../src/service";
import { type FxRateSourceProvider } from "../../src/sources/types";
import { createNoopFeesService } from "@bedrock/test-utils/bedrock/harness/fx";

function createFxServiceWithProvider(provider: FxRateSourceProvider) {
    return createFxService({
        db,
        feesService: createNoopFeesService(),
        currenciesService: createCurrenciesService({ db }),
        rateSourceProviders: { cbr: provider },
    });
}

describe("FX rates integration", () => {
    it("returns manual rates and invalidates manual cache after each write", async () => {
        const provider = {
            source: "cbr" as const,
            fetchLatest: vi.fn(async () => {
                throw new Error("CBR provider should not be called when manual rate exists");
            }),
        };
        const service = createFxServiceWithProvider(provider);

        await service.setManualRate({
            base: "USD",
            quote: "EUR",
            rateNum: 101n,
            rateDen: 100n,
            asOf: new Date("2026-02-18T00:00:00.000Z"),
        });

        const first = await service.getLatestRate("USD", "EUR", new Date("2026-02-18T12:00:00.000Z"));
        expect(first.source).toBe("manual");
        expect(first.rateNum).toBe(101n);
        expect(first.rateDen).toBe(100n);

        await service.setManualRate({
            base: "USD",
            quote: "EUR",
            rateNum: 102n,
            rateDen: 100n,
            asOf: new Date("2026-02-19T00:00:00.000Z"),
        });

        const second = await service.getLatestRate("USD", "EUR", new Date("2026-02-19T12:00:00.000Z"));
        expect(second.source).toBe("manual");
        expect(second.rateNum).toBe(102n);
        expect(second.rateDen).toBe(100n);
        expect(provider.fetchLatest).not.toHaveBeenCalled();
    });

    it("refreshes CBR rates on read when TTL is expired", async () => {
        const staleSyncedAt = new Date(Date.now() - DAY_IN_SECONDS * 2 * 1000);
        const staleAsOf = new Date("2026-02-17T00:00:00.000Z");
        const freshAsOf = new Date("2026-02-19T00:00:00.000Z");

        await db.insert(schema.fxRateSources).values({
            source: "cbr",
            ttlSeconds: DAY_IN_SECONDS,
            lastSyncedAt: staleSyncedAt,
            lastPublishedAt: staleAsOf,
            lastStatus: "ok",
            lastError: null,
            updatedAt: staleSyncedAt,
        });

        await db.insert(schema.fxRates).values({
            source: "cbr",
            baseCurrencyId: currencyIdForCode("USD"),
            quoteCurrencyId: currencyIdForCode("RUB"),
            rateNum: 80n,
            rateDen: 1n,
            asOf: staleAsOf,
        });

        const provider = {
            source: "cbr" as const,
            fetchLatest: vi.fn(async () => ({
                source: "cbr" as const,
                fetchedAt: new Date("2026-02-19T10:00:00.000Z"),
                publishedAt: freshAsOf,
                rates: [
                    {
                        base: "USD",
                        quote: "RUB",
                        rateNum: 90n,
                        rateDen: 1n,
                        asOf: freshAsOf,
                    },
                ],
            })),
        };
        const service = createFxServiceWithProvider(provider);

        const rate = await service.getLatestRate("USD", "RUB", new Date("2026-02-19T12:00:00.000Z"));
        expect(rate.source).toBe("cbr");
        expect(rate.rateNum).toBe(90n);
        expect(rate.rateDen).toBe(1n);
        expect(provider.fetchLatest).toHaveBeenCalledTimes(1);

        const rows = await db
            .select()
            .from(schema.fxRates)
            .where(and(
                eq(schema.fxRates.source, "cbr"),
                eq(schema.fxRates.baseCurrencyId, currencyIdForCode("USD")),
                eq(schema.fxRates.quoteCurrencyId, currencyIdForCode("RUB")),
            ))
            .orderBy(desc(schema.fxRates.asOf));
        expect(rows).toHaveLength(2);
        expect(rows[0]!.asOf.toISOString()).toBe(freshAsOf.toISOString());
        expect(rows[0]!.rateNum).toBe(90n);

        const [status] = await db
            .select()
            .from(schema.fxRateSources)
            .where(eq(schema.fxRateSources.source, "cbr"))
            .limit(1);
        expect(status).toBeDefined();
        expect(status!.lastStatus).toBe("ok");
        expect(status!.lastError).toBeNull();
        expect(status!.lastSyncedAt!.getTime()).toBeGreaterThan(staleSyncedAt.getTime());
    });

    it("throws RateSourceStaleError and does not return stale CBR rates when refresh fails", async () => {
        const staleSyncedAt = new Date(Date.now() - DAY_IN_SECONDS * 3 * 1000);
        const staleAsOf = new Date("2026-02-16T00:00:00.000Z");

        await db.insert(schema.fxRateSources).values({
            source: "cbr",
            ttlSeconds: DAY_IN_SECONDS,
            lastSyncedAt: staleSyncedAt,
            lastPublishedAt: staleAsOf,
            lastStatus: "ok",
            lastError: null,
            updatedAt: staleSyncedAt,
        });

        await db.insert(schema.fxRates).values({
            source: "cbr",
            baseCurrencyId: currencyIdForCode("USD"),
            quoteCurrencyId: currencyIdForCode("RUB"),
            rateNum: 79n,
            rateDen: 1n,
            asOf: staleAsOf,
        });

        const provider = {
            source: "cbr" as const,
            fetchLatest: vi.fn(async () => {
                throw new Error("cbr unavailable");
            }),
        };
        const service = createFxServiceWithProvider(provider);

        await expect(service.getLatestRate("USD", "RUB", new Date("2026-02-19T12:00:00.000Z")))
            .rejects
            .toThrow(RateSourceStaleError);

        const [status] = await db
            .select()
            .from(schema.fxRateSources)
            .where(eq(schema.fxRateSources.source, "cbr"))
            .limit(1);
        expect(status).toBeDefined();
        expect(status!.lastStatus).toBe("error");
        expect(status!.lastError).toContain("cbr unavailable");
        expect(provider.fetchLatest).toHaveBeenCalledTimes(1);
    });
});
