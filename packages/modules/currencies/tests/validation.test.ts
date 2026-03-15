import { describe, expect, it } from "vitest";

import {
  CurrencySchema,
  CreateCurrencyInputSchema,
  UpdateCurrencyInputSchema,
} from "../src/contracts";

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
        precision: -1,
      }),
    ).toThrow();
  });

  it("accepts create input with precision 0", () => {
    const parsed = CreateCurrencyInputSchema.parse({
      name: "Japanese Yen",
      code: "jpy",
      symbol: "JPY",
      precision: 0,
    });

    expect(parsed).toEqual({
      name: "Japanese Yen",
      code: "JPY",
      symbol: "JPY",
      precision: 0,
    });
  });

  it("accepts partial update input and rejects invalid values", () => {
    const parsed = UpdateCurrencyInputSchema.parse({
      name: "Euro",
      precision: 3,
    });
    expect(parsed).toEqual({ name: "Euro", precision: 3 });

    expect(() =>
      UpdateCurrencyInputSchema.parse({
        precision: -1,
      }),
    ).toThrow();

    expect(() =>
      UpdateCurrencyInputSchema.parse({
        precision: "2",
      }),
    ).toThrow();
  });

  it("normalizes update code to upper case", () => {
    const parsed = UpdateCurrencyInputSchema.parse({
      code: " eur ",
    });

    expect(parsed).toEqual({ code: "EUR" });
  });
});
