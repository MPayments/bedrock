import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

import { createCurrenciesService } from "@bedrock/currencies";
import { createPersistenceContext } from "@bedrock/platform/persistence";
import { DAY_IN_SECONDS } from "@bedrock/shared/money/math";
import { schema } from "@bedrock/treasury/schema";

import { db } from "./setup";
import { createTreasuryRatesWorkerDefinition } from "../../src/worker";
import { createTreasuryTestHarness } from "../create-treasury-test-service";
import { createNoopFeesService } from "../helpers";

async function runWorkerOnce(
    worker: ReturnType<typeof createTreasuryRatesWorkerDefinition>,
    now: Date,
) {
    const result = await worker.runOnce({
        now,
        signal: new AbortController().signal,
    });
    return result.processed;
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

function createXeProvider(publishedAt: Date) {
    return {
        source: "xe" as const,
        fetchLatest: vi.fn(async () => ({
            source: "xe" as const,
            fetchedAt: publishedAt,
            publishedAt,
            rates: [
                {
                    base: "USD",
                    quote: "RUB",
                    rateNum: 92n,
                    rateDen: 1n,
                    asOf: publishedAt,
                },
            ],
        })),
    };
}

describe("Treasury worker integration", () => {
    it("syncs expired sources in runOnce()", async () => {
        const now = new Date("2026-02-19T12:00:00.000Z");
        const provider = createProvider(new Date("2026-02-19T00:00:00.000Z"));
        const investingProvider = {
            source: "investing" as const,
            fetchLatest: vi.fn(async () => {
                throw new Error("investing unavailable in this test");
            }),
        };
        const xeProvider = {
            source: "xe" as const,
            fetchLatest: vi.fn(async () => {
                throw new Error("xe unavailable in this test");
            }),
        };

        const { treasuryModule } = createTreasuryTestHarness({
            persistence: createPersistenceContext(db),
            feesService: createNoopFeesService(),
            currenciesService: createCurrenciesService({ db }),
            rateSourceProviders: {
                cbr: provider,
                investing: investingProvider,
                xe: xeProvider,
            },
        });
        const worker = createTreasuryRatesWorkerDefinition({ treasuryModule: treasuryModule as any });

        const processed = await runWorkerOnce(worker, now);
        expect(processed).toBe(1);
        expect(provider.fetchLatest).toHaveBeenCalledTimes(1);
        expect(investingProvider.fetchLatest).toHaveBeenCalledTimes(1);
        expect(xeProvider.fetchLatest).toHaveBeenCalledTimes(1);

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
        const xeProvider = createXeProvider(initialNow);

        const { treasuryModule, service } = createTreasuryTestHarness({
            persistence: createPersistenceContext(db),
            feesService: createNoopFeesService(),
            currenciesService: createCurrenciesService({ db }),
            rateSourceProviders: {
                cbr: provider,
                investing: investingProvider,
                xe: xeProvider,
            },
        });
        const worker = createTreasuryRatesWorkerDefinition({ treasuryModule: treasuryModule as any });

        await service.rates.syncRatesFromSource({
            source: "cbr",
            force: true,
            now: initialNow,
        });
        await service.rates.syncRatesFromSource({
            source: "investing",
            force: true,
            now: initialNow,
        });
        await service.rates.syncRatesFromSource({
            source: "xe",
            force: true,
            now: initialNow,
        });
        provider.fetchLatest.mockClear();
        investingProvider.fetchLatest.mockClear();
        xeProvider.fetchLatest.mockClear();

        const processed = await runWorkerOnce(worker, workerNow);
        expect(processed).toBe(0);
        expect(provider.fetchLatest).not.toHaveBeenCalled();
        expect(investingProvider.fetchLatest).not.toHaveBeenCalled();
        expect(xeProvider.fetchLatest).not.toHaveBeenCalled();
    });
});
