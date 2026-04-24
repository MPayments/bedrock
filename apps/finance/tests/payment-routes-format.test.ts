import { describe, expect, it } from "vitest";

import {
  getPaymentRouteBaseRateLines,
  getPaymentRouteRateLines,
} from "@/features/payment-routes/lib/format";
import type { PaymentRouteCalculation } from "@bedrock/treasury/contracts";

const RUB = {
  code: "RUB",
  id: "00000000-0000-4000-8000-000000000101",
  label: "RUB - Russian Ruble",
  name: "Russian Ruble",
  precision: 2,
};

const CNY = {
  code: "CNY",
  id: "00000000-0000-4000-8000-000000000102",
  label: "CNY - Chinese Yuan",
  name: "Chinese Yuan",
  precision: 2,
};

describe("payment route format", () => {
  it("builds forward and reverse clean, client, and cost rates from exact minor amounts", () => {
    expect(
      getPaymentRouteRateLines({
        cleanAmountInMinor: "1200000",
        cleanAmountOutMinor: "111000",
        clientAmountOutMinor: "108495",
        clientTotalInMinor: "1230000",
        costAmountOutMinor: "108495",
        costPriceInMinor: "1250000",
        currencyIn: RUB,
        currencyOut: CNY,
      }),
    ).toEqual({
      cleanForward: "1 RUB ~= 0.092500 CNY",
      cleanReverse: "1 CNY ~= 10.810811 RUB",
      clientForward: "1 RUB ~= 0.088207 CNY",
      clientReverse: "1 CNY ~= 11.336928 RUB",
      costForward: "1 RUB ~= 0.086796 CNY",
      costReverse: "1 CNY ~= 11.521268 RUB",
    });
  });

  it("builds a composed base rate from raw route leg ratios", () => {
    const calculation: PaymentRouteCalculation = {
      additionalFees: [],
      amountInMinor: "77836434",
      amountOutMinor: "1000000",
      chargedFeeTotals: [],
      cleanAmountOutMinor: "1000000",
      clientTotalInMinor: "77836434",
      computedAt: "2026-04-19T09:58:00.000Z",
      costPriceInMinor: "78108862",
      currencyInId: RUB.id,
      currencyOutId: "00000000-0000-4000-8000-000000000103",
      feeTotals: [],
      grossAmountOutMinor: "1000000",
      internalFeeTotals: [],
      legs: [
        {
          asOf: "2026-04-19T09:58:00.000Z",
          fees: [],
          fromCurrencyId: RUB.id,
          grossOutputMinor: "3670000",
          id: "leg-1",
          idx: 1,
          inputAmountMinor: "100000",
          netOutputMinor: "3670000",
          rateDen: "100",
          rateNum: "367",
          rateSource: "market",
          toCurrencyId: CNY.id,
        },
        {
          asOf: "2026-04-19T09:58:00.000Z",
          fees: [],
          fromCurrencyId: CNY.id,
          grossOutputMinor: "12845",
          id: "leg-2",
          idx: 2,
          inputAmountMinor: "1000000",
          netOutputMinor: "12845",
          rateDen: "2000",
          rateNum: "7",
          rateSource: "derived",
          toCurrencyId: "00000000-0000-4000-8000-000000000103",
        },
      ],
      lockedSide: "currency_in",
      netAmountOutMinor: "1000000",
    };
    const USD = {
      code: "USD",
      id: "00000000-0000-4000-8000-000000000103",
      label: "USD - US Dollar",
      name: "US Dollar",
      precision: 2,
    };

    expect(
      getPaymentRouteBaseRateLines({
        calculation,
        currencies: [RUB, CNY, USD],
      }),
    ).toEqual({
      baseForward: "1 RUB ~= 0.012845 USD",
      baseReverse: "1 USD ~= 77.851304 RUB",
    });
  });
});
