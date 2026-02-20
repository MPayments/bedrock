import { describe, expect, it, vi } from "vitest";

import { RateNotFoundError } from "../src/errors";
import { createRateQueryHandlers } from "../src/commands/rates/query";

type RateRow = {
    rateNum: bigint;
    rateDen: bigint;
    source: string;
    asOf: Date;
};

function createHarness() {
    const byCode = new Map([
        ["USD", { id: "cur-usd", code: "USD" }],
        ["EUR", { id: "cur-eur", code: "EUR" }],
        ["RUB", { id: "cur-rub", code: "RUB" }],
    ]);

    const manualRates = new Map<string, RateRow>();
    const sourceRates = new Map<string, RateRow>();

    const pairKey = (baseId: string, quoteId: string) => `${baseId}|${quoteId}`;
    const sourcePairKey = (source: "cbr" | "investing", baseId: string, quoteId: string) => `${source}|${pairKey(baseId, quoteId)}`;

    const currenciesService = {
        findByCode: vi.fn(async (code: string) => {
            const normalized = code.trim().toUpperCase();
            const currency = byCode.get(normalized);
            if (!currency) throw new Error(`Unknown currency: ${normalized}`);
            return currency;
        }),
    };

    const deps = {
        ensureSourceFresh: vi.fn(async () => undefined),
        getLatestManualRate: vi.fn(async (baseId: string, quoteId: string) => manualRates.get(pairKey(baseId, quoteId))),
        getLatestRateBySource: vi.fn(async (baseId: string, quoteId: string, _asOf: Date, source: "cbr" | "investing") => sourceRates.get(sourcePairKey(source, baseId, quoteId))),
    };

    const handlers = createRateQueryHandlers({ currenciesService } as any, deps);

    return {
        handlers,
        deps,
        byCode,
        setManualRate(base: "USD" | "EUR" | "RUB", quote: "USD" | "EUR" | "RUB", row: RateRow) {
            const baseId = byCode.get(base)!.id;
            const quoteId = byCode.get(quote)!.id;
            manualRates.set(pairKey(baseId, quoteId), row);
        },
        setSourceRate(source: "cbr" | "investing", base: "USD" | "EUR" | "RUB", quote: "USD" | "EUR" | "RUB", row: RateRow) {
            const baseId = byCode.get(base)!.id;
            const quoteId = byCode.get(quote)!.id;
            sourceRates.set(sourcePairKey(source, baseId, quoteId), row);
        },
    };
}

describe("rate query handlers", () => {
    it("returns manual latest rate without source refresh", async () => {
        const h = createHarness();
        h.setManualRate("USD", "EUR", {
            source: "manual",
            rateNum: 101n,
            rateDen: 100n,
            asOf: new Date("2026-02-19T00:00:00.000Z"),
        });

        const rate = await h.handlers.getLatestRate("usd", "eur", new Date("2026-02-19T12:00:00.000Z"));

        expect(rate.source).toBe("manual");
        expect(h.deps.ensureSourceFresh).not.toHaveBeenCalled();
    });

    it("falls back to CBR source when manual rate is absent", async () => {
        const h = createHarness();
        h.setSourceRate("cbr", "USD", "RUB", {
            source: "cbr",
            rateNum: 90n,
            rateDen: 1n,
            asOf: new Date("2026-02-19T00:00:00.000Z"),
        });

        const rate = await h.handlers.getLatestRate("USD", "RUB", new Date("2026-02-19T12:00:00.000Z"));

        expect(rate.source).toBe("cbr");
        expect(rate.rateNum).toBe(90n);
        expect(h.deps.ensureSourceFresh).toHaveBeenCalledWith("cbr", expect.any(Date));
    });

    it("falls back to investing when cbr has no pair", async () => {
        const h = createHarness();
        h.setSourceRate("investing", "USD", "RUB", {
            source: "investing",
            rateNum: 91n,
            rateDen: 1n,
            asOf: new Date("2026-02-19T00:00:00.000Z"),
        });

        const rate = await h.handlers.getLatestRate("USD", "RUB", new Date("2026-02-19T12:00:00.000Z"));

        expect(rate.source).toBe("investing");
        expect(rate.rateNum).toBe(91n);
        expect(h.deps.ensureSourceFresh).toHaveBeenNthCalledWith(1, "cbr", expect.any(Date));
        expect(h.deps.ensureSourceFresh).toHaveBeenNthCalledWith(2, "investing", expect.any(Date));
    });

    it("throws RateNotFoundError when no direct rate exists", async () => {
        const h = createHarness();

        await expect(h.handlers.getLatestRate("USD", "RUB", new Date("2026-02-19T12:00:00.000Z")))
            .rejects
            .toThrow(RateNotFoundError);
        expect(h.deps.ensureSourceFresh).toHaveBeenNthCalledWith(1, "cbr", expect.any(Date));
        expect(h.deps.ensureSourceFresh).toHaveBeenNthCalledWith(2, "investing", expect.any(Date));
    });

    it("returns identity rate for same currency", async () => {
        const h = createHarness();

        const rate = await h.handlers.getCrossRate("USD", "USD", new Date("2026-02-19T12:00:00.000Z"));

        expect(rate).toEqual({
            base: "USD",
            quote: "USD",
            rateNum: 1n,
            rateDen: 1n,
        });
        expect(h.deps.ensureSourceFresh).not.toHaveBeenCalled();
    });

    it("uses inverse rate when direct cross rate is absent", async () => {
        const h = createHarness();
        h.setSourceRate("cbr", "EUR", "USD", {
            source: "cbr",
            rateNum: 5n,
            rateDen: 2n,
            asOf: new Date("2026-02-19T00:00:00.000Z"),
        });

        const rate = await h.handlers.getCrossRate("USD", "EUR", new Date("2026-02-19T12:00:00.000Z"));

        expect(rate).toEqual({
            base: "USD",
            quote: "EUR",
            rateNum: 2n,
            rateDen: 5n,
        });
    });

    it("builds cross rate through anchor using inverse fallbacks", async () => {
        const h = createHarness();
        h.setSourceRate("cbr", "USD", "EUR", {
            source: "cbr",
            rateNum: 1n,
            rateDen: 2n,
            asOf: new Date("2026-02-19T00:00:00.000Z"),
        });
        h.setSourceRate("cbr", "RUB", "USD", {
            source: "cbr",
            rateNum: 1n,
            rateDen: 90n,
            asOf: new Date("2026-02-19T00:00:00.000Z"),
        });

        const rate = await h.handlers.getCrossRate("EUR", "RUB", new Date("2026-02-19T12:00:00.000Z"), "USD");

        expect(rate).toEqual({
            base: "EUR",
            quote: "RUB",
            rateNum: 180n,
            rateDen: 1n,
        });
    });

    it("throws when anchor path is impossible", async () => {
        const h = createHarness();

        await expect(h.handlers.getCrossRate("USD", "RUB", new Date("2026-02-19T12:00:00.000Z"), "USD"))
            .rejects
            .toThrow(RateNotFoundError);
    });

    it("propagates non-RateNotFound errors from direct lookup", async () => {
        const h = createHarness();
        h.deps.getLatestManualRate.mockImplementationOnce(async () => {
            throw new Error("db failure");
        });

        await expect(h.handlers.getCrossRate("USD", "EUR", new Date("2026-02-19T12:00:00.000Z")))
            .rejects
            .toThrow("db failure");
    });
});
