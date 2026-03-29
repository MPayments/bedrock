import { describe, expect, it } from "vitest";

import {
  buildFxQuotePreviewRequest,
  formatFxQuotePreviewMinorAmount,
  getFinancialLineBucketLabel,
} from "@/features/documents/lib/fx-quote-preview";

describe("fx quote preview helpers", () => {
  it("builds preview requests from amount and currencies", () => {
    expect(
      buildFxQuotePreviewRequest({
        amount: "100.50",
        fromCurrency: "usd",
        toCurrency: "eur",
      }),
    ).toEqual({
      fromCurrency: "USD",
      toCurrency: "EUR",
      fromAmountMinor: "10050",
    });
  });

  it("returns null for incomplete or invalid preview inputs", () => {
    expect(
      buildFxQuotePreviewRequest({
        amount: "",
        fromCurrency: "USD",
        toCurrency: "EUR",
      }),
    ).toBeNull();
    expect(
      buildFxQuotePreviewRequest({
        amount: "100.00",
        fromCurrency: "USD",
        toCurrency: "USD",
      }),
    ).toBeNull();
    expect(
      buildFxQuotePreviewRequest({
        amount: "bad",
        fromCurrency: "USD",
        toCurrency: "EUR",
      }),
    ).toBeNull();
  });

  it("formats preview amounts and bucket labels", () => {
    expect(
      formatFxQuotePreviewMinorAmount({
        amountMinor: "125",
        currency: "USD",
      }),
    ).toBe("1.25 USD");
    expect(getFinancialLineBucketLabel("spread_revenue")).toBe("Спред");
  });
});
