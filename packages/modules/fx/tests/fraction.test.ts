import { describe, expect, it } from "vitest";

import {
  parseDecimalToFraction,
  parsePositiveInt,
  reduceFraction,
} from "@bedrock/shared/money/math";

describe("fraction helpers", () => {
  it("parses plain, fractional, and scientific decimals", () => {
    expect(parseDecimalToFraction("12")).toEqual({ num: 12n, den: 1n });
    expect(parseDecimalToFraction(" 1,25 ")).toEqual({ num: 5n, den: 4n });
    expect(parseDecimalToFraction("1.2E3")).toEqual({ num: 1200n, den: 1n });
    expect(parseDecimalToFraction("12E-1")).toEqual({ num: 6n, den: 5n });
  });

  it("rejects malformed decimals", () => {
    expect(() => parseDecimalToFraction("")).toThrow("invalid decimal number");
    expect(() => parseDecimalToFraction("1.2.3")).toThrow("invalid decimal number");
    expect(() => parseDecimalToFraction(".5")).toThrow("invalid decimal number");
    expect(() => parseDecimalToFraction("1.")).toThrow("invalid decimal number");
    expect(() => parseDecimalToFraction("0")).toThrow("decimal must be positive");
  });

  it("rejects malformed scientific notation", () => {
    expect(() => parseDecimalToFraction("E2")).toThrow("invalid decimal number");
    expect(() => parseDecimalToFraction("1E")).toThrow("invalid decimal number");
    expect(() => parseDecimalToFraction("1E+2E3")).toThrow(
      "invalid decimal number",
    );
    expect(() => parseDecimalToFraction("1E+X")).toThrow("invalid decimal number");
    expect(() =>
      parseDecimalToFraction("1E2", { allowScientific: false }),
    ).toThrow("invalid decimal number");
  });

  it("parses positive integer strings", () => {
    expect(parsePositiveInt("42")).toBe(42n);
    expect(parsePositiveInt("  900  ")).toBe(900n);
    expect(parsePositiveInt("0")).toBeNull();
    expect(parsePositiveInt("abc")).toBeNull();
    expect(parsePositiveInt("-1")).toBeNull();
  });

  it("reduces fractions and validates positivity", () => {
    expect(reduceFraction(50n, 100n)).toEqual({ num: 1n, den: 2n });
    expect(() => reduceFraction(0n, 1n)).toThrow("fraction must be positive");
    expect(() => reduceFraction(1n, 0n)).toThrow("fraction must be positive");
  });
});
