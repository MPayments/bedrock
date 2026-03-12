import { describe, expect, it, vi } from "vitest";

import { schema } from "@bedrock/fx/schema";
import { ValidationError } from "@bedrock/common/errors";

import { createManualRateHandlers } from "../../src/fx/commands/rates/manual-rates";

function createContext() {
    const values = vi.fn(async () => undefined);
    const db = {
        insert: vi.fn(() => ({
            values,
        })),
    } as any;
    const currenciesService = {
        findByCode: vi.fn(async (code: string) => ({ id: `cur-${code.toLowerCase()}`, code })),
    } as any;

    return {
        db,
        values,
        currenciesService,
    };
}

describe("manual rate handlers", () => {
    it("persists manual source by default and invalidates cache", async () => {
        const context = createContext();
        const invalidateRateCache = vi.fn();

        const handlers = createManualRateHandlers(
            {
                db: context.db,
                currenciesService: context.currenciesService,
            } as any,
            { invalidateRateCache },
        );

        const asOf = new Date("2026-02-19T00:00:00.000Z");
        await handlers.setManualRate({
            base: "USD",
            quote: "EUR",
            rateNum: 100n,
            rateDen: 99n,
            asOf,
        });

        expect(context.db.insert).toHaveBeenCalledWith(schema.fxRates);
        expect(context.values).toHaveBeenCalledWith({
            baseCurrencyId: "cur-usd",
            quoteCurrencyId: "cur-eur",
            rateNum: 100n,
            rateDen: 99n,
            asOf,
            source: "manual",
        });
        expect(invalidateRateCache).toHaveBeenCalledTimes(1);
    });

    it("persists explicit non-cbr source", async () => {
        const context = createContext();
        const invalidateRateCache = vi.fn();

        const handlers = createManualRateHandlers(
            {
                db: context.db,
                currenciesService: context.currenciesService,
            } as any,
            { invalidateRateCache },
        );

        await handlers.setManualRate({
            base: "USD",
            quote: "EUR",
            rateNum: 101n,
            rateDen: 100n,
            asOf: new Date("2026-02-19T00:00:00.000Z"),
            source: "bank",
        });

        const inserted = context.values.mock.calls[0]?.[0];
        expect(inserted.source).toBe("bank");
        expect(invalidateRateCache).toHaveBeenCalledTimes(1);
    });

    it("rejects reserved cbr source before DB write", async () => {
        const context = createContext();
        const invalidateRateCache = vi.fn();

        const handlers = createManualRateHandlers(
            {
                db: context.db,
                currenciesService: context.currenciesService,
            } as any,
            { invalidateRateCache },
        );

        await expect(handlers.setManualRate({
            base: "USD",
            quote: "EUR",
            rateNum: 1n,
            rateDen: 1n,
            asOf: new Date("2026-02-19T00:00:00.000Z"),
            source: "cbr",
        })).rejects.toThrow(ValidationError);

        expect(context.db.insert).not.toHaveBeenCalled();
        expect(invalidateRateCache).not.toHaveBeenCalled();
    });
});
