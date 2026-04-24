import { describe, expect, it } from "vitest";

import {
  getPaymentRouteAdditionalFeeTotals,
  getPaymentRouteChargedFeeTotals,
  getPaymentRouteCleanAmountOutMinor,
  getPaymentRouteClientTotalInMinor,
  getPaymentRouteCostPriceInMinor,
  getPaymentRouteInternalFeeTotals,
  getPaymentRouteLegFeeTotals,
} from "@/features/payment-routes/lib/cost-summary";
import type { PaymentRouteCalculation } from "@bedrock/treasury/contracts";

const USD = "00000000-0000-4000-8000-000000000101";
const EUR = "00000000-0000-4000-8000-000000000102";

const CALCULATION: PaymentRouteCalculation = {
  additionalFees: [
    {
      amountMinor: "100",
      chargeToCustomer: true,
      currencyId: USD,
      id: "additional-1",
      inputImpactCurrencyId: USD,
      inputImpactMinor: "100",
      kind: "fixed",
      label: "Банк",
      outputImpactCurrencyId: EUR,
      outputImpactMinor: "50",
      routeInputImpactMinor: "100",
    },
    {
      amountMinor: "25",
      chargeToCustomer: false,
      currencyId: USD,
      id: "additional-2",
      inputImpactCurrencyId: USD,
      inputImpactMinor: "25",
      kind: "fixed",
      label: "Корреспондент",
      outputImpactCurrencyId: EUR,
      outputImpactMinor: "13",
      routeInputImpactMinor: "25",
    },
  ],
  amountInMinor: "10000",
  amountOutMinor: "5000",
  chargedFeeTotals: [
    {
      amountMinor: "300",
      currencyId: USD,
    },
  ],
  cleanAmountOutMinor: "5200",
  clientTotalInMinor: "10100",
  computedAt: "2026-04-16T12:00:00.000Z",
  costPriceInMinor: "10325",
  currencyInId: USD,
  currencyOutId: EUR,
  feeTotals: [
    {
      amountMinor: "325",
      currencyId: USD,
    },
  ],
  grossAmountOutMinor: "5000",
  internalFeeTotals: [
    {
      amountMinor: "25",
      currencyId: USD,
    },
  ],
  legs: [
    {
      asOf: "2026-04-16T12:00:00.000Z",
      fees: [
        {
          amountMinor: "200",
          chargeToCustomer: true,
          currencyId: USD,
          id: "leg-fee-1",
          inputImpactCurrencyId: USD,
          inputImpactMinor: "200",
          kind: "fixed",
          label: "Шаг 1",
          outputImpactCurrencyId: USD,
          outputImpactMinor: "200",
          routeInputImpactMinor: "200",
        },
      ],
      fromCurrencyId: USD,
      grossOutputMinor: "9800",
      id: "leg-1",
      idx: 1,
      inputAmountMinor: "10000",
      netOutputMinor: "9800",
      rateDen: "1",
      rateNum: "1",
      rateSource: "identity",
      toCurrencyId: USD,
    },
  ],
  lockedSide: "currency_in",
  netAmountOutMinor: "5000",
};

describe("payment route cost summary", () => {
  it("groups leg fees separately from additional fees", () => {
    expect(getPaymentRouteLegFeeTotals(CALCULATION)).toEqual([
      {
        amountMinor: "200",
        currencyId: USD,
      },
    ]);

    expect(getPaymentRouteAdditionalFeeTotals(CALCULATION)).toEqual([
      {
        amountMinor: "125",
        currencyId: USD,
      },
    ]);
  });

  it("returns charged and internal totals from the calculation summary", () => {
    expect(getPaymentRouteChargedFeeTotals(CALCULATION)).toEqual([
      {
        amountMinor: "300",
        currencyId: USD,
      },
    ]);
    expect(getPaymentRouteInternalFeeTotals(CALCULATION)).toEqual([
      {
        amountMinor: "25",
        currencyId: USD,
      },
    ]);
  });

  it("reads client and cost totals directly from the calculation summary", () => {
    expect(getPaymentRouteClientTotalInMinor(CALCULATION)).toBe("10100");
    expect(getPaymentRouteCostPriceInMinor(CALCULATION)).toBe("10325");
    expect(getPaymentRouteCleanAmountOutMinor(CALCULATION)).toBe("5200");
  });
});
