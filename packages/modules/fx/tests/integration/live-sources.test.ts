import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

import { createCurrenciesService } from "@bedrock/currencies";
import { schema } from "@bedrock/fx/schema";

import { db } from "./setup";
import { createFxService } from "../../src/service";

const EXTERNAL_API_TESTS_ENABLED = process.env.ENABLE_EXTERNAL_API_TESTS === "1";
const describeExternal = EXTERNAL_API_TESTS_ENABLED ? describe : describe.skip;

function createNoopFeesService() {
    return {
        calculateFxQuoteFeeComponents: vi.fn(async () => []),
        saveQuoteFeeComponents: vi.fn(async () => undefined),
        getQuoteFeeComponents: vi.fn(async () => []),
    } as any;
}

function createLiveFxService() {
    return createFxService({
        db,
        feesService: createNoopFeesService(),
        currenciesService: createCurrenciesService({ db }),
    });
}

describeExternal("FX live sources integration", () => {
    it("syncs CBR source with real HTTP requests", async () => {
        const service = createLiveFxService();
        const now = new Date();

        const result = await service.syncRatesFromSource({
            source: "cbr",
            force: true,
            now,
        });

        expect(result.source).toBe("cbr");
        expect(result.synced).toBe(true);
        expect(result.rateCount).toBeGreaterThan(0);
        expect(result.publishedAt).toBeInstanceOf(Date);
        expect(Number.isNaN(result.publishedAt!.getTime())).toBe(false);
        expect(result.status.lastStatus).toBe("ok");
        expect(result.status.lastError).toBeNull();

        const [statusRow] = await db
            .select()
            .from(schema.fxRateSources)
            .where(eq(schema.fxRateSources.source, "cbr"))
            .limit(1);

        expect(statusRow).toBeDefined();
        expect(statusRow!.lastStatus).toBe("ok");
        expect(statusRow!.lastError).toBeNull();

        const cbrAsOf = new Date(result.publishedAt!.getTime() + 60_000);
        const liveRate = await service.getLatestRate("USD", "RUB", cbrAsOf);
        expect(liveRate.source).toBe("cbr");
        expect(liveRate.rateNum > 0n).toBe(true);
        expect(liveRate.rateDen > 0n).toBe(true);
    });

    it("syncs investing source with real HTTP requests", async () => {
        const service = createLiveFxService();
        const now = new Date();

        const result = await service.syncRatesFromSource({
            source: "investing",
            force: true,
            now,
        });

        expect(result.source).toBe("investing");
        expect(result.synced).toBe(true);
        expect(result.rateCount).toBeGreaterThan(0);
        expect(result.publishedAt).toBeInstanceOf(Date);
        expect(Number.isNaN(result.publishedAt!.getTime())).toBe(false);
        expect(result.status.lastStatus).toBe("ok");
        expect(result.status.lastError).toBeNull();

        const [statusRow] = await db
            .select()
            .from(schema.fxRateSources)
            .where(eq(schema.fxRateSources.source, "investing"))
            .limit(1);

        expect(statusRow).toBeDefined();
        expect(statusRow!.lastStatus).toBe("ok");
        expect(statusRow!.lastError).toBeNull();

        const [anyInvestingRate] = await db
            .select()
            .from(schema.fxRates)
            .where(eq(schema.fxRates.source, "investing"))
            .limit(1);

        expect(anyInvestingRate).toBeDefined();
        expect(anyInvestingRate!.rateNum > 0n).toBe(true);
        expect(anyInvestingRate!.rateDen > 0n).toBe(true);
    });
});
