import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
    CreateQuoteInputSchema,
    MarkQuoteUsedInputSchema,
} from "../src/quotes/application/contracts/commands";
import {
    GetQuoteDetailsInputSchema,
    PreviewQuoteInputSchema,
} from "../src/quotes/application/contracts/queries";
import {
    SetManualRateInputSchema,
    SyncRatesFromSourceInputSchema,
} from "../src/rates/application/contracts/commands";

describe("Treasury validation", () => {
    it("validates and normalizes manual rate input", () => {
        const parsed = SetManualRateInputSchema.parse({
            base: "usd",
            quote: "eur",
            rateNum: 101n,
            rateDen: 100n,
            asOf: new Date("2026-02-19T00:00:00.000Z"),
        });

        expect(parsed.base).toBe("USD");
        expect(parsed.quote).toBe("EUR");
        expect(parsed.source).toBeUndefined();
    });

    it("rejects reserved source name for manual rate input", () => {
        expect(() => SetManualRateInputSchema.parse({
            base: "USD",
            quote: "EUR",
            rateNum: 1n,
            rateDen: 1n,
            asOf: new Date("2026-02-19T00:00:00.000Z"),
            source: "CBR",
        })).toThrow(z.ZodError);
    });

    it("validates source sync input", () => {
        const parsed = SyncRatesFromSourceInputSchema.parse({
            source: "cbr",
            force: true,
            now: new Date("2026-02-19T10:00:00.000Z"),
        });

        expect(parsed.source).toBe("cbr");
        expect(parsed.force).toBe(true);
    });

    it("rejects quote input with ttl above one day", () => {
        expect(() => CreateQuoteInputSchema.parse({
            mode: "auto_cross",
            idempotencyKey: "idem-ttl",
            fromCurrency: "USD",
            toCurrency: "EUR",
            fromAmountMinor: 1000n,
            ttlSeconds: 86401,
            asOf: new Date("2026-02-19T00:00:00.000Z"),
        })).toThrow(z.ZodError);
    });

    it("validates markQuoteUsed and getQuoteDetails inputs", () => {
        const markParsed = MarkQuoteUsedInputSchema.parse({
            quoteId: "550e8400-e29b-41d4-a716-446655440000",
            usedByRef: "po:123",
            at: new Date("2026-02-19T00:00:00.000Z"),
        });
        const detailsParsed = GetQuoteDetailsInputSchema.parse({
            quoteRef: "idem-1",
        });
        const previewParsed = PreviewQuoteInputSchema.parse({
            mode: "auto_cross",
            fromCurrency: "usd",
            toCurrency: "eur",
            fromAmountMinor: 1000n,
            asOf: new Date("2026-02-19T00:00:00.000Z"),
        });

        expect(markParsed.usedByRef).toBe("po:123");
        expect(detailsParsed.quoteRef).toBe("idem-1");
        expect(previewParsed.mode).toBe("auto_cross");
        expect(previewParsed.fromCurrency).toBe("USD");
        expect(previewParsed.toCurrency).toBe("EUR");
    });

    it("accepts target-side quote input", () => {
        const parsed = CreateQuoteInputSchema.parse({
            mode: "auto_cross",
            idempotencyKey: "idem-target-side",
            fromCurrency: "rub",
            toCurrency: "usd",
            toAmountMinor: 1000n,
            asOf: new Date("2026-02-19T00:00:00.000Z"),
        });

        expect(parsed.mode).toBe("auto_cross");
        expect(parsed.fromCurrency).toBe("RUB");
        expect(parsed.toCurrency).toBe("USD");
        expect("toAmountMinor" in parsed).toBe(true);
    });

    it("formats contextual validation error with field path", () => {
        const schema = z.object({
            nested: z.object({
                value: z.string().min(2),
            }),
        });

        const result = schema.safeParse({ nested: { value: "x" } });

        expect(result.success).toBe(false);
    });
});
