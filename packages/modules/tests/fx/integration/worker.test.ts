import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

import { DAY_IN_SECONDS } from "@bedrock/foundation/kernel/constants";
import { schema } from "@bedrock/modules/fx/schema";
import { createCurrenciesService } from "@bedrock/platform/currencies";

import { db } from "./setup";
import { createFxService } from "../../../src/fx/service";
import { createFxRatesWorkerDefinition } from "../../../src/fx/worker";

async function runWorkerOnce(
    worker: ReturnType<typeof createFxRatesWorkerDefinition>,
    now: Date,
) {
    const result = await worker.runOnce({
        now,
        signal: new AbortController().signal,
    });
    return result.processed;
}

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

function createInvestingProvider(publishedAt: Date) {
    return {
        source: "investing" as const,
        fetchLatest: vi.fn(async () => ({
            source: "investing" as const,
            fetchedAt: publishedAt,
            publishedAt,
            rates: [
                {
                    base: "USD",
                    quote: "RUB",
                    rateNum: 91n,
                    rateDen: 1n,
                    asOf: publishedAt,
                },
            ],
        })),
    };
}

describe("FX worker integration", () => {
    it("syncs expired sources in runOnce()", async () => {
        const now = new Date("2026-02-19T12:00:00.000Z");
        const provider = createProvider(new Date("2026-02-19T00:00:00.000Z"));
        const investingProvider = {
            source: "investing" as const,
            fetchLatest: vi.fn(async () => {
                throw new Error("investing unavailable in this test");
            }),
        };

        const fxService = createFxService({
            db,
            feesService: createNoopFeesService(),
            currenciesService: createCurrenciesService({ db }),
            rateSourceProviders: {
                cbr: provider,
                investing: investingProvider,
            },
        });
        const worker = createFxRatesWorkerDefinition({ fxService });

        const processed = await runWorkerOnce(worker, now);
        expect(processed).toBe(1);
        expect(provider.fetchLatest).toHaveBeenCalledTimes(1);
        expect(investingProvider.fetchLatest).toHaveBeenCalledTimes(1);

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

    it("skips sources with non-expired TTL in runOnce()", async () => {
        const initialNow = new Date("2026-02-19T12:00:00.000Z");
        const workerNow = new Date("2026-02-19T12:04:00.000Z");
        const provider = createProvider(initialNow);
        const investingProvider = createInvestingProvider(initialNow);

        const fxService = createFxService({
            db,
            feesService: createNoopFeesService(),
            currenciesService: createCurrenciesService({ db }),
            rateSourceProviders: {
                cbr: provider,
                investing: investingProvider,
            },
        });
        const worker = createFxRatesWorkerDefinition({ fxService });

        await fxService.syncRatesFromSource({
            source: "cbr",
            force: true,
            now: initialNow,
        });
        await fxService.syncRatesFromSource({
            source: "investing",
            force: true,
            now: initialNow,
        });
        provider.fetchLatest.mockClear();
        investingProvider.fetchLatest.mockClear();

        const processed = await runWorkerOnce(worker, workerNow);
        expect(processed).toBe(0);
        expect(provider.fetchLatest).not.toHaveBeenCalled();
        expect(investingProvider.fetchLatest).not.toHaveBeenCalled();
    });
});
