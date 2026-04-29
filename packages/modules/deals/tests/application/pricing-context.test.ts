import { describe, expect, it } from "vitest";

import { DealPricingContextSchema } from "../../src/application/contracts/dto";
import { applyDealPricingContextPatch } from "../../src/application/shared/pricing-context";

describe("applyDealPricingContextPatch", () => {
  it("allows clearing manual client pricing without clearing omitted fields", () => {
    const context = DealPricingContextSchema.parse({
      commercialDraft: {
        clientPricing: {
          clientRate: {
            rateDen: "100",
            rateNum: "1",
          },
          clientTotalMinor: null,
          commercialFeeCurrency: null,
          commercialFeeMinor: null,
          discountCurrency: null,
          discountMinor: null,
          mode: "client_rate",
          passThroughPolicy: "none",
        },
        executionSource: { type: "route_execution" },
        fixedFeeAmount: "10.00",
        fixedFeeCurrency: "USD",
        quoteMarkupBps: 25,
      },
      fundingAdjustments: [],
      revision: 3,
      routeAttachment: null,
    });

    const snapshot = applyDealPricingContextPatch({
      context,
      patch: {
        commercialDraft: {
          clientPricing: null,
        },
        expectedRevision: 3,
      },
    });

    expect(snapshot.commercialDraft).toMatchObject({
      clientPricing: null,
      executionSource: { type: "route_execution" },
      fixedFeeAmount: "10.00",
      fixedFeeCurrency: "USD",
      quoteMarkupBps: 25,
    });
  });
});
