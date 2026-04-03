import { describe, expect, it } from "vitest";

import { CreateCalculationInputSchema } from "../../src/contracts";

describe("calculations contracts", () => {
  it("rejects fxQuoteId when the primary rate source is not fx_quote", () => {
    expect(() =>
      CreateCalculationInputSchema.parse({
        calculationCurrencyId: "00000000-0000-4000-8000-000000000001",
        originalAmountMinor: "10000",
        feeBps: "125",
        feeAmountMinor: "125",
        totalAmountMinor: "10125",
        baseCurrencyId: "00000000-0000-4000-8000-000000000002",
        feeAmountInBaseMinor: "100",
        totalInBaseMinor: "8100",
        additionalExpensesCurrencyId: null,
        additionalExpensesAmountMinor: "0",
        additionalExpensesInBaseMinor: "0",
        totalWithExpensesInBaseMinor: "8100",
        rateSource: "manual",
        rateNum: "81",
        rateDen: "100",
        calculationTimestamp: "2026-03-30T12:00:00.000Z",
        fxQuoteId: "00000000-0000-4000-8000-000000000010",
      }),
    ).toThrow("fxQuoteId is allowed only when rateSource is fx_quote");
  });

  it("requires additional-expenses rate fields when the expense currency differs from base", () => {
    expect(() =>
      CreateCalculationInputSchema.parse({
        calculationCurrencyId: "00000000-0000-4000-8000-000000000001",
        originalAmountMinor: "10000",
        feeBps: "125",
        feeAmountMinor: "125",
        totalAmountMinor: "10125",
        baseCurrencyId: "00000000-0000-4000-8000-000000000002",
        feeAmountInBaseMinor: "100",
        totalInBaseMinor: "8100",
        additionalExpensesCurrencyId: "00000000-0000-4000-8000-000000000003",
        additionalExpensesAmountMinor: "250",
        additionalExpensesInBaseMinor: "200",
        totalWithExpensesInBaseMinor: "8300",
        rateSource: "manual",
        rateNum: "81",
        rateDen: "100",
        calculationTimestamp: "2026-03-30T12:00:00.000Z",
      }),
    ).toThrow(
      "additional expenses rate fields are required when additionalExpensesCurrencyId differs from baseCurrencyId",
    );
  });
});
