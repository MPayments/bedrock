import { describe, expect, it } from "vitest";
import {
    CurrencySchema,
    CreateCurrencyInputSchema,
    UpdateCurrencyInputSchema,
} from "../src/validation";

describe("currencies validation", () => {
    it("parses valid currency entity and coerces dates", () => {
        const parsed = CurrencySchema.parse({
            id: "00000000-0000-4000-8000-000000000101",
            name: "US Dollar",
            code: "USD",
            symbol: "$",
            precision: 2,
            createdAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
            updatedAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
        });

        expect(parsed.code).toBe("USD");
        expect(parsed.createdAt).toBeInstanceOf(Date);
        expect(parsed.updatedAt).toBeInstanceOf(Date);
    });

    it("rejects invalid create input", () => {
        expect(() =>
            CreateCurrencyInputSchema.parse({
                name: "",
                code: "",
                symbol: "",
                precision: 0,
            }),
        ).toThrow();
    });

    it("accepts partial update input and rejects invalid values", () => {
        const parsed = UpdateCurrencyInputSchema.parse({
            name: "Euro",
            precision: 3,
        });
        expect(parsed).toEqual({ name: "Euro", precision: 3 });

        expect(() =>
            UpdateCurrencyInputSchema.parse({
                precision: "2",
            }),
        ).toThrow();
    });
});
