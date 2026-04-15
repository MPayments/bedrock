import { describe, expect, it } from "vitest";

import { CreateCalculationInputSchema } from "../../src/contracts";

describe("calculations contracts", () => {
  it("rejects fxQuoteId when the primary rate source is not fx_quote", () => {
    expect(() =>
      CreateCalculationInputSchema.parse({
        agreementVersionId: null,
        agreementFeeBps: "125",
        agreementFeeAmountMinor: "125",
        calculationCurrencyId: "00000000-0000-4000-8000-000000000001",
        originalAmountMinor: "10000",
        totalFeeBps: "125",
        totalFeeAmountMinor: "125",
        totalAmountMinor: "10125",
        baseCurrencyId: "00000000-0000-4000-8000-000000000002",
        totalFeeAmountInBaseMinor: "100",
        totalInBaseMinor: "8100",
        additionalExpensesCurrencyId: null,
        additionalExpensesAmountMinor: "0",
        additionalExpensesInBaseMinor: "0",
        fixedFeeAmountMinor: "0",
        fixedFeeCurrencyId: null,
        pricingProvenance: null,
        quoteMarkupAmountMinor: "0",
        quoteMarkupBps: "0",
        referenceRateAsOf: null,
        referenceRateSource: null,
        referenceRateNum: null,
        referenceRateDen: null,
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
        agreementVersionId: null,
        agreementFeeBps: "125",
        agreementFeeAmountMinor: "125",
        calculationCurrencyId: "00000000-0000-4000-8000-000000000001",
        originalAmountMinor: "10000",
        totalFeeBps: "125",
        totalFeeAmountMinor: "125",
        totalAmountMinor: "10125",
        baseCurrencyId: "00000000-0000-4000-8000-000000000002",
        totalFeeAmountInBaseMinor: "100",
        totalInBaseMinor: "8100",
        additionalExpensesCurrencyId: "00000000-0000-4000-8000-000000000003",
        additionalExpensesAmountMinor: "250",
        additionalExpensesInBaseMinor: "200",
        fixedFeeAmountMinor: "0",
        fixedFeeCurrencyId: null,
        pricingProvenance: null,
        quoteMarkupAmountMinor: "0",
        quoteMarkupBps: "0",
        referenceRateAsOf: null,
        referenceRateSource: null,
        referenceRateNum: null,
        referenceRateDen: null,
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

  it("accepts route provenance and enriched financial line metadata", () => {
    expect(
      CreateCalculationInputSchema.parse({
        agreementVersionId: null,
        agreementFeeBps: "125",
        agreementFeeAmountMinor: "125",
        calculationCurrencyId: "00000000-0000-4000-8000-000000000001",
        originalAmountMinor: "10000",
        totalFeeBps: "125",
        totalFeeAmountMinor: "125",
        totalAmountMinor: "10125",
        baseCurrencyId: "00000000-0000-4000-8000-000000000002",
        totalFeeAmountInBaseMinor: "100",
        totalInBaseMinor: "8100",
        dealId: "00000000-0000-4000-8000-000000000010",
        dealSnapshot: { type: "payment" },
        additionalExpensesCurrencyId: null,
        additionalExpensesAmountMinor: "0",
        additionalExpensesInBaseMinor: "0",
        fixedFeeAmountMinor: "0",
        fixedFeeCurrencyId: null,
        pricingProvenance: null,
        quoteMarkupAmountMinor: "0",
        quoteMarkupBps: "0",
        routeVersionId: "00000000-0000-4000-8000-000000000011",
        routeSnapshot: { version: 1 },
        referenceRateAsOf: null,
        referenceRateSource: null,
        referenceRateNum: null,
        referenceRateDen: null,
        state: "accepted",
        totalWithExpensesInBaseMinor: "8100",
        rateSource: "manual",
        rateNum: "81",
        rateDen: "100",
        calculationTimestamp: "2026-03-30T12:00:00.000Z",
        financialLines: [
          {
            kind: "provider_fee_expense",
            currencyId: "00000000-0000-4000-8000-000000000002",
            amountMinor: "25",
            componentCode: "liq-fee",
            componentFamily: "liquidity",
            classification: "expense",
            formulaType: "bps",
            basisType: "deal_source_amount",
            basisAmountMinor: "10000",
            inputBps: "10",
            routeVersionId: "00000000-0000-4000-8000-000000000011",
            sourceKind: "quote",
          },
        ],
      }),
    ).toMatchObject({
      dealId: "00000000-0000-4000-8000-000000000010",
      routeVersionId: "00000000-0000-4000-8000-000000000011",
      state: "accepted",
    });
  });
});
