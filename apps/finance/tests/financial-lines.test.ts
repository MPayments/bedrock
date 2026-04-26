import { describe, expect, it } from "vitest";

import {
  createEmptyFinancialLineFormValue,
  getFinancialLinePercentAmountPreview,
  getLockedFinancialLineCurrency,
  resolveFinancialLineCalcMethod,
} from "@bedrock/sdk-documents-form-ui/lib/financial-lines";
import type { DocumentFormField } from "@bedrock/sdk-documents-form-ui/lib/document-form-registry";

const financialLinesField: Extract<DocumentFormField, { kind: "financialLines" }> =
  {
    kind: "financialLines",
    name: "financialLines",
    label: "Financial lines",
    bucketOptions: [{ value: "fee_revenue", label: "Fee revenue" }],
    supportedCalcMethods: ["fixed", "percent"],
    baseAmountFieldName: "amount",
    baseCurrencyFieldName: "currency",
  };

describe("financial-lines form helpers", () => {
  it("defaults new rows to fixed amounts", () => {
    expect(createEmptyFinancialLineFormValue(financialLinesField)).toEqual({
      calcMethod: "fixed",
      bucket: "fee_revenue",
      currency: "",
      amount: "",
      percent: "",
      memo: "",
    });
  });

  it("locks percent rows to the current base currency", () => {
    expect(
      getLockedFinancialLineCurrency({
        calcMethod: "percent",
        rowCurrency: "EUR",
        baseCurrency: "USD",
      }),
    ).toBe("USD");
    expect(
      getLockedFinancialLineCurrency({
        calcMethod: "fixed",
        rowCurrency: "EUR",
        baseCurrency: "USD",
      }),
    ).toBe("EUR");
  });

  it("falls back to fixed when percent is unsupported or missing", () => {
    expect(
      resolveFinancialLineCalcMethod({
        calcMethod: undefined,
        supportedCalcMethods: ["fixed", "percent"],
      }),
    ).toBe("fixed");
    expect(
      resolveFinancialLineCalcMethod({
        calcMethod: "percent",
        supportedCalcMethods: ["fixed"],
      }),
    ).toBe("fixed");
  });

  it("builds a preview amount for percent rows", () => {
    expect(
      getFinancialLinePercentAmountPreview({
        baseAmount: "300000",
        baseCurrency: "USD",
        percent: "1.25",
      }),
    ).toBe("3750 USD");
    expect(
      getFinancialLinePercentAmountPreview({
        baseAmount: "300000",
        baseCurrency: "USD",
        percent: "-1.25",
      }),
    ).toBe("-3750 USD");
  });

  it("returns no preview for incomplete or invalid percent preview input", () => {
    expect(
      getFinancialLinePercentAmountPreview({
        baseAmount: "",
        baseCurrency: "USD",
        percent: "1.25",
      }),
    ).toBeNull();
    expect(
      getFinancialLinePercentAmountPreview({
        baseAmount: "300000",
        baseCurrency: "USD",
        percent: "bad",
      }),
    ).toBeNull();
  });
});
