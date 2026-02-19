import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

import { createCurrenciesService } from "@bedrock/currencies";
import { schema } from "@bedrock/db/schema";
import { DAY_IN_SECONDS } from "@bedrock/kernel/constants";

import { createFxService } from "../../src/service";
import { createFxRatesWorker } from "../../src/worker";
import { db } from "./setup";

function createNoopFeesService() {
    return {
        calculateFxQuoteFeeComponents: vi.fn(async () => []),
        saveQuoteFeeComponents: vi.fn(async () => undefined),
        getQuoteFeeComponents: vi.fn(async () => []),
    } as any;
}

function createProvider(publishedAt: Date) {
    return {
        source: "cbr" as const,
        fetchLatest: vi.fn(async () => ({
            source: "cbr" as const,
            fetchedAt: publishedAt,
            publishedAt,
            rates: [
                {
                    base: "USD",
                    quote: "RUB",
                    rateNum: 90n,
                    rateDen: 1n,
                    asOf: publishedAt,
                },
            ],
        })),
    };
}

describe("FX worker integration", () => {
    it("syncs expired sources in processOnce()", async () => {
        const now = new Date("2026-02-19T12:00:00.000Z");
        const provider = createProvider(new Date("2026-02-19T00:00:00.000Z"));

        const fxService = createFxService({
            db,
            feesService: createNoopFeesService(),
            currenciesService: createCurrenciesService({ db }),
            rateSourceProviders: { cbr: provider },
        });
        const worker = createFxRatesWorker({ fxService });

        const processed = await worker.processOnce({ now });
        expect(processed).toBe(1);
        expect(provider.fetchLatest).toHaveBeenCalledTimes(1);

        const [status] = await db
            .select()
            .from(schema.fxRateSources)
            .where(eq(schema.fxRateSources.source, "cbr"))
            .limit(1);

        expect(status).toBeDefined();
        expect(status!.ttlSeconds).toBe(DAY_IN_SECONDS);
        expect(status!.lastStatus).toBe("ok");
        expect(status!.lastSyncedAt?.toISOString()).toBe(now.toISOString());
    });

    it("skips sources with non-expired TTL in processOnce()", async () => {
        const initialNow = new Date("2026-02-19T12:00:00.000Z");
        const workerNow = new Date("2026-02-19T13:00:00.000Z");
        const provider = createProvider(new Date("2026-02-19T00:00:00.000Z"));

        const fxService = createFxService({
            db,
            feesService: createNoopFeesService(),
            currenciesService: createCurrenciesService({ db }),
            rateSourceProviders: { cbr: provider },
        });
        const worker = createFxRatesWorker({ fxService });

        await fxService.syncRatesFromSource({
            source: "cbr",
            force: true,
            now: initialNow,
        });
        provider.fetchLatest.mockClear();

        const processed = await worker.processOnce({ now: workerNow });
        expect(processed).toBe(0);
        expect(provider.fetchLatest).not.toHaveBeenCalled();
    });
});
