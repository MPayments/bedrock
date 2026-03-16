import { describe, expect, it } from "vitest";

import {
  getDefaultPrecision,
  isValidCurrency,
  normalizeCurrency,
  parseCurrency,
} from "../src/catalog";

describe("currencies catalog", () => {
  it("normalizes and validates currency codes", () => {
    expect(normalizeCurrency(" usd ")).toBe("USD");
    expect(isValidCurrency("eur")).toBe(true);
    expect(isValidCurrency("bad currency")).toBe(false);
    expect(parseCurrency("btc")).toBe("BTC");
  });

  it("returns the expected default precision", () => {
    expect(getDefaultPrecision("USD")).toBe(2);
    expect(getDefaultPrecision("JPY")).toBe(0);
  });
});
