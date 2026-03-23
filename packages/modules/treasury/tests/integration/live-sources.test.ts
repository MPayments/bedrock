import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { createCurrenciesService } from "@bedrock/currencies";
import { createPersistenceContext } from "@bedrock/platform/persistence";
import { createDefaultRateSourceProviders } from "@bedrock/treasury/providers";
import { schema } from "@bedrock/treasury/schema";

import { db } from "./setup";
import { createTreasuryTestService } from "../create-treasury-test-service";
import { createNoopFeesService } from "../helpers";

const EXTERNAL_API_TESTS_ENABLED = process.env.ENABLE_EXTERNAL_API_TESTS === "1";
const describeExternal = EXTERNAL_API_TESTS_ENABLED ? describe : describe.skip;

function createLiveTreasuryService() {
    return createTreasuryTestService({
        persistence: createPersistenceContext(db),
        feesService: createNoopFeesService(),
        currenciesService: createCurrenciesService({ db }),
        rateSourceProviders: createDefaultRateSourceProviders(),
    });
}

describeExternal("Treasury live sources integration", () => {
    it("syncs CBR source with real HTTP requests", async () => {
        const service = createLiveTreasuryService();
        const now = new Date();

        const result = await service.rates.syncRatesFromSource({
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
        const liveRate = await service.rates.getLatestRate("USD", "RUB", cbrAsOf);
        expect(liveRate.source).toBe("cbr");
        expect(liveRate.rateNum > 0n).toBe(true);
        expect(liveRate.rateDen > 0n).toBe(true);
    });

    it("syncs investing source with real HTTP requests", async () => {
        const service = createLiveTreasuryService();
        const now = new Date();

        const result = await service.rates.syncRatesFromSource({
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

    it("syncs XE source with real HTTP requests", async () => {
        const service = createLiveTreasuryService();
        const now = new Date();

        const result = await service.rates.syncRatesFromSource({
            source: "xe",
            force: true,
            now,
        });

        expect(result.source).toBe("xe");
        expect(result.synced).toBe(true);
        expect(result.rateCount).toBeGreaterThan(0);
        expect(result.publishedAt).toBeInstanceOf(Date);
        expect(Number.isNaN(result.publishedAt!.getTime())).toBe(false);
        expect(result.status.lastStatus).toBe("ok");
        expect(result.status.lastError).toBeNull();

        const [statusRow] = await db
            .select()
            .from(schema.fxRateSources)
            .where(eq(schema.fxRateSources.source, "xe"))
            .limit(1);

        expect(statusRow).toBeDefined();
        expect(statusRow!.lastStatus).toBe("ok");
        expect(statusRow!.lastError).toBeNull();

        const xeRates = await db
            .select()
            .from(schema.fxRates)
            .where(eq(schema.fxRates.source, "xe"));

        expect(xeRates.length).toBeGreaterThanOrEqual(2);
        for (const rate of xeRates) {
            expect(rate.rateNum > 0n).toBe(true);
            expect(rate.rateDen > 0n).toBe(true);
        }
    });
});
