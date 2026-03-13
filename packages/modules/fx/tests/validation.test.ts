import { describe, expect, it } from "vitest";
import { z } from "zod";

import { ValidationError } from "@bedrock/core/errors";

import {
    validateGetQuoteDetailsInput,
    validateInput,
    validateMarkQuoteUsedInput,
    validateQuoteInput,
    validateSetManualRateInput,
    validateSyncRatesFromSourceInput,
} from "../src/validation";

describe("FX validation", () => {
    it("validates and normalizes manual rate input", () => {
        const parsed = validateSetManualRateInput({
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
        expect(() => validateSetManualRateInput({
            base: "USD",
            quote: "EUR",
            rateNum: 1n,
            rateDen: 1n,
            asOf: new Date("2026-02-19T00:00:00.000Z"),
            source: "CBR",
        })).toThrow(ValidationError);
    });

    it("validates source sync input", () => {
        const parsed = validateSyncRatesFromSourceInput({
            source: "cbr",
            force: true,
            now: new Date("2026-02-19T10:00:00.000Z"),
        });

        expect(parsed.source).toBe("cbr");
        expect(parsed.force).toBe(true);
    });

    it("rejects quote input with ttl above one day", () => {
        expect(() => validateQuoteInput({
            mode: "auto_cross",
            idempotencyKey: "idem-ttl",
            fromCurrency: "USD",
            toCurrency: "EUR",
            fromAmountMinor: 1000n,
            ttlSeconds: 86401,
            asOf: new Date("2026-02-19T00:00:00.000Z"),
        })).toThrow(ValidationError);
    });

    it("validates markQuoteUsed and getQuoteDetails inputs", () => {
        const markParsed = validateMarkQuoteUsedInput({
            quoteId: "550e8400-e29b-41d4-a716-446655440000",
            usedByRef: "po:123",
            at: new Date("2026-02-19T00:00:00.000Z"),
        });
        const detailsParsed = validateGetQuoteDetailsInput({ quoteRef: "idem-1" });

        expect(markParsed.usedByRef).toBe("po:123");
        expect(detailsParsed.quoteRef).toBe("idem-1");
    });

    it("formats contextual validation error with field path", () => {
        const schema = z.object({
            nested: z.object({
                value: z.string().min(2),
            }),
        });

        expect(() => validateInput(schema, { nested: { value: "x" } }, "custom"))
            .toThrow("custom: nested.value");
    });
});
