import { describe, expect, it } from "vitest";

import {
  calculateBpsAmountMinorHalfUp,
  calculatePercentAmountMinor,
  formatPercentFromBps,
  MAX_PERCENT_BPS,
  parseSignedPercentToBps,
  PERCENT_BPS_SCALE,
} from "@bedrock/shared/money";

describe("percent money helpers", () => {
  it("exports shared percent bounds and scale", () => {
    expect(MAX_PERCENT_BPS).toBe(1_000_000);
    expect(PERCENT_BPS_SCALE).toBe(10_000n);
  });

  it("parses and formats signed percent values as basis points", () => {
    expect(parseSignedPercentToBps("1.25")).toBe(125);
    expect(parseSignedPercentToBps("-1.5")).toBe(-150);
    expect(parseSignedPercentToBps("+0,75")).toBe(75);
    expect(formatPercentFromBps(125)).toBe("1.25");
    expect(formatPercentFromBps(-150)).toBe("-1.5");
  });

  it("rejects malformed percent input", () => {
    expect(() => parseSignedPercentToBps("")).toThrow(
      "percent must be a number",
    );
    expect(() => parseSignedPercentToBps("1.234")).toThrow(
      "percent must be a number",
    );
    expect(() => parseSignedPercentToBps("1.2.3")).toThrow(
      "percent must be a number",
    );
    expect(() => parseSignedPercentToBps("10000.01")).toThrow(
      "percent is too large",
    );
  });

  it("computes signed percent amounts with half-up minor-unit rounding", () => {
    expect(calculatePercentAmountMinor(100050n, 125)).toBe(1251n);
    expect(calculatePercentAmountMinor(100050n, -125)).toBe(-1251n);
    expect(calculateBpsAmountMinorHalfUp(100050n, 125n)).toBe(1251n);
    expect(calculateBpsAmountMinorHalfUp(100050n, -125n)).toBe(-1251n);
    expect(calculateBpsAmountMinorHalfUp(100050n, 0n)).toBe(0n);
  });
});
