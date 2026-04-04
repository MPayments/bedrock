import { describe, expect, it } from "vitest";

import {
  calculatePercentAmountMinor,
  compileManualFinancialLine,
  formatPercentFromBps,
  parseSignedPercentToBps,
} from "../src/financial-lines";

describe("document financial-line percent helpers", () => {
  it("parses and formats signed basis points", () => {
    expect(parseSignedPercentToBps("1.25")).toBe(125);
    expect(parseSignedPercentToBps("-1.5")).toBe(-150);
    expect(formatPercentFromBps(125)).toBe("1.25");
    expect(formatPercentFromBps(-150)).toBe("-1.5");
  });

  it("computes signed percent amounts with half-up minor-unit rounding", () => {
    expect(calculatePercentAmountMinor(100050n, 125)).toBe(1251n);
    expect(calculatePercentAmountMinor(100050n, -125)).toBe(-1251n);
  });

  it("compiles fixed and percent manual lines", () => {
    expect(
      compileManualFinancialLine({
        line: {
          calcMethod: "fixed",
          bucket: "fee_revenue",
          currency: "USD",
          amount: "10.25",
        },
        baseAmountMinor: "10000",
        baseCurrency: "USD",
        createId: () => "manual:fixed",
      }),
    ).toMatchObject({
      id: "manual:fixed",
      calcMethod: "fixed",
      amountMinor: "1025",
      currency: "USD",
    });

    expect(
      compileManualFinancialLine({
        line: {
          calcMethod: "percent",
          bucket: "fee_revenue",
          currency: "USD",
          percent: "1.25",
        },
        baseAmountMinor: "10000",
        baseCurrency: "USD",
        createId: () => "manual:percent",
      }),
    ).toMatchObject({
      id: "manual:percent",
      calcMethod: "percent",
      percentBps: 125,
      amountMinor: "125",
      currency: "USD",
    });
  });
});
