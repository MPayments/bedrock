import { describe, expect, it } from "vitest";

import { getPaymentRouteRateLines } from "@/features/payment-routes/lib/format";

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
  it("builds forward and reverse clean/effective rates from exact minor amounts", () => {
    expect(
      getPaymentRouteRateLines({
        amountInMinor: "1200000",
        cleanAmountOutMinor: "111000",
        costInclusiveAmountInMinor: "1250000",
        effectiveAmountOutMinor: "108495",
        currencyIn: RUB,
        currencyOut: CNY,
      }),
    ).toEqual({
      cleanForward: "1 RUB ~= 0.092500 CNY",
      cleanReverse: "1 CNY ~= 10.810811 RUB",
      effectiveForward: "1 RUB ~= 0.086796 CNY",
      effectiveReverse: "1 CNY ~= 11.521268 RUB",
    });
  });
});
