import { describe, expect, it } from "vitest";

import {
  getPaymentRouteAdditionalFeeTotals,
  getPaymentRouteLegFeeTotals,
  getPaymentRoutePureAmountOutMinor,
  getPaymentRouteTotalClientCostInMinor,
} from "@/features/payment-routes/lib/cost-summary";
import type { PaymentRouteCalculation } from "@bedrock/treasury/contracts";

const USD = "00000000-0000-4000-8000-000000000101";
const EUR = "00000000-0000-4000-8000-000000000102";

const CALCULATION: PaymentRouteCalculation = {
  additionalFees: [
    {
      amountMinor: "100",
      currencyId: USD,
      id: "additional-1",
      inputImpactCurrencyId: USD,
      inputImpactMinor: "100",
      kind: "fixed",
      label: "Банк",
      outputImpactCurrencyId: EUR,
      outputImpactMinor: "50",
    },
    {
      amountMinor: "25",
      currencyId: USD,
      id: "additional-2",
      inputImpactCurrencyId: USD,
      inputImpactMinor: "25",
      kind: "fixed",
      label: "Корреспондент",
      outputImpactCurrencyId: EUR,
      outputImpactMinor: "13",
    },
  ],
  amountInMinor: "10000",
  amountOutMinor: "5000",
  computedAt: "2026-04-16T12:00:00.000Z",
  currencyInId: USD,
  currencyOutId: EUR,
  feeTotals: [
    {
      amountMinor: "325",
      currencyId: USD,
    },
  ],
  grossAmountOutMinor: "5000",
  legs: [
    {
      asOf: "2026-04-16T12:00:00.000Z",
      fees: [
        {
          amountMinor: "200",
          currencyId: USD,
          id: "leg-fee-1",
          inputImpactCurrencyId: USD,
          inputImpactMinor: "200",
          kind: "fixed",
          label: "Шаг 1",
          outputImpactCurrencyId: USD,
          outputImpactMinor: "200",
        },
      ],
      fromCurrencyId: USD,
      grossOutputMinor: "9800",
      id: "leg-1",
      idx: 1,
      inputAmountMinor: "10000",
      kind: "transfer",
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

  it("adds additional fees to route input to derive total client cost", () => {
    expect(getPaymentRouteTotalClientCostInMinor(CALCULATION)).toBe("10125");
  });

  it("reconstructs pure route output before step commissions from route rates", () => {
    expect(getPaymentRoutePureAmountOutMinor(CALCULATION)).toBe("10000");
  });
});
