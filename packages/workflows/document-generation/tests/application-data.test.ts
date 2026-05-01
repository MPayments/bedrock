import { describe, expect, it } from "vitest";

import { assembleApplicationData } from "../src/data-assembly/application-data";

describe("assembleApplicationData", () => {
  it("uses the FX payment amount and client RUB rate for application templates", () => {
    const data = assembleApplicationData(
      {
        id: "deal-1",
        bankName: "Test Bank",
        swiftCode: "TESTUS33",
      },
      {
        currencyCode: "RUB",
        originalAmount: "8998674.26",
        paymentAmount: "120000",
        paymentCurrencyCode: "USD",
        rate: "74.988952",
        totalAmount: "8998674.26",
        totalWithExpensesInBase: "8998674.26",
        totalFeeAmountInBase: "0",
        totalInBase: "8998674.26",
        additionalExpensesInBase: "0",
        agreementFeeAmount: "0",
        quoteMarkupAmount: "0",
        totalFeeAmount: "0",
        fixedFeeAmount: "0",
      },
      {},
      {},
      {},
      {},
      {},
      new Date("2026-04-01T00:00:00.000Z"),
      "ru",
    );

    expect(data).toEqual(
      expect.objectContaining({
        currencyCode: "USD",
        bankName: "Test Bank",
        originalAmount: "120 000.00",
        rate: "74.988952",
        siwftCode: "TESTUS33",
        swiftCode: "TESTUS33",
        totalWithExpensesInRub: "8 998 674.26",
      }),
    );
  });
});
