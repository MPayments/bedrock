import { describe, expect, it } from "vitest";

import { GetRateHistoryInputSchema } from "../src/rates/application/contracts/queries";

describe("GetRateHistoryInputSchema", () => {
  it("coerces HTTP query string values for rate history", () => {
    const parsed = GetRateHistoryInputSchema.parse({
      base: "AED",
      from: "2026-04-01T00:00:00.000Z",
      limit: "200",
      quote: "EUR",
    });

    expect(parsed.base).toBe("AED");
    expect(parsed.quote).toBe("EUR");
    expect(parsed.limit).toBe(200);
    expect(parsed.from).toBeInstanceOf(Date);
  });
});
