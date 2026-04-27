import { describe, expect, it } from "vitest";

import { extractNetProfitFromQuoteTrace } from "../src/finance/profitability";

function makeTrace(profitability: unknown) {
  return {
    pricingTrace: {
      metadata: {
        crmPricingSnapshot: {
          profitability,
        },
      },
    },
  };
}

describe("extractNetProfitFromQuoteTrace", () => {
  const VALID_PROFITABILITY = {
    commercialRevenueMinor: "265000",
    costPriceMinor: "24260000",
    currency: "RUB",
    customerPrincipalMinor: "24104000",
    customerTotalMinor: "24104000",
    passThroughMinor: "0",
    profitMinor: "108467",
    profitPercentOnCost: "0.45",
  };

  it("returns null when quote details are absent", () => {
    expect(extractNetProfitFromQuoteTrace(null)).toBeNull();
  });

  it("returns null when trace has no metadata envelope", () => {
    expect(
      extractNetProfitFromQuoteTrace({ pricingTrace: {} }),
    ).toBeNull();
  });

  it("returns null when the CRM pricing snapshot is missing", () => {
    expect(
      extractNetProfitFromQuoteTrace({
        pricingTrace: { metadata: {} },
      }),
    ).toBeNull();
  });

  it("returns null when the stored profitability payload does not parse", () => {
    expect(
      extractNetProfitFromQuoteTrace(
        makeTrace({ profitMinor: "not-a-number" }),
      ),
    ).toBeNull();
  });

  it("extracts the stored net-profit payload when the trace is well-formed", () => {
    const result = extractNetProfitFromQuoteTrace(
      makeTrace(VALID_PROFITABILITY),
    );

    expect(result).toEqual(VALID_PROFITABILITY);
  });

  it("parses negative net profit (unprofitable deal)", () => {
    const unprofitable = {
      ...VALID_PROFITABILITY,
      profitMinor: "-500000",
      profitPercentOnCost: "-2.07",
    };
    const result = extractNetProfitFromQuoteTrace(makeTrace(unprofitable));

    expect(result?.profitMinor).toBe("-500000");
    expect(result?.profitPercentOnCost).toBe("-2.07");
  });
});
