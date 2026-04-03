import { describe, expect, it } from "vitest";

import {
  decimalRateToFraction,
  decimalToMinorString,
  resolveDefaultToCurrency,
} from "@/features/treasury/deals/components/quote-request-utils";

describe("treasury deal quote request utils", () => {
  it("converts manual rate decimal into explicit route fraction", () => {
    expect(decimalRateToFraction("97.15")).toEqual({
      rateDen: "100",
      rateNum: "9715",
    });
    expect(decimalRateToFraction("0")).toBeNull();
  });

  it("keeps amount conversion consistent for quote payloads", () => {
    expect(decimalToMinorString("23000", 2)).toBe("2300000");
    expect(decimalToMinorString("23000.55", 2)).toBe("2300055");
  });

  it("prefers target currency from the deal over the first available option", () => {
    expect(
      resolveDefaultToCurrency({
        currentValue: "",
        options: [
          {
            code: "AED",
            id: "cur-aed",
            label: "AED",
          },
          {
            code: "USD",
            id: "cur-usd",
            label: "USD",
          },
        ],
        preferredTargetCurrencyId: "cur-usd",
        sourceCurrencyCode: "RUB",
      }),
    ).toBe("USD");
  });
});
