import { describe, expect, it } from "vitest";

import { hasOnlyAsciiDigits, isDecimalString } from "../../src/core/utils";

describe("hasOnlyAsciiDigits", () => {
  it("returns true for non-empty ASCII digit strings", () => {
    expect(hasOnlyAsciiDigits("0")).toBe(true);
    expect(hasOnlyAsciiDigits("1234567890")).toBe(true);
  });

  it("returns false for empty strings and non-digit characters", () => {
    expect(hasOnlyAsciiDigits("")).toBe(false);
    expect(hasOnlyAsciiDigits("12.3")).toBe(false);
    expect(hasOnlyAsciiDigits("12a3")).toBe(false);
    expect(hasOnlyAsciiDigits("١٢٣")).toBe(false);
  });
});

describe("isDecimalString", () => {
  it("returns true for valid decimal strings", () => {
    expect(isDecimalString("0")).toBe(true);
    expect(isDecimalString("1")).toBe(true);
    expect(isDecimalString("10.25")).toBe(true);
    expect(isDecimalString("0.5")).toBe(true);
  });

  it("returns false for invalid decimal strings", () => {
    expect(isDecimalString("")).toBe(false);
    expect(isDecimalString("00")).toBe(false);
    expect(isDecimalString("01.2")).toBe(false);
    expect(isDecimalString(".5")).toBe(false);
    expect(isDecimalString("1.")).toBe(false);
    expect(isDecimalString("1.2.3")).toBe(false);
    expect(isDecimalString("1a")).toBe(false);
  });
});
