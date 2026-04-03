import { describe, expect, it } from "vitest";

import { formatAgreementFeeRuleLabel } from "./agreement-fee-format";

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/gu, " ").trim();
}

describe("formatAgreementFeeRuleLabel", () => {
  it("formats agent fee values from decimal bps strings", () => {
    expect(
      formatAgreementFeeRuleLabel({
        currencyCode: null,
        kind: "agent_fee",
        unit: "bps",
        value: "200.00000000",
      }),
    ).toBe("Агентская комиссия 2%");

    expect(
      formatAgreementFeeRuleLabel({
        currencyCode: null,
        kind: "agent_fee",
        unit: "bps",
        value: "125.00000000",
      }),
    ).toBe("Агентская комиссия 1.25%");

    expect(
      formatAgreementFeeRuleLabel({
        currencyCode: null,
        kind: "agent_fee",
        unit: "bps",
        value: "0.00000000",
      }),
    ).toBe("Агентская комиссия 0%");
  });

  it("formats fixed fees as money using the provided currency code", () => {
    expect(
      normalizeWhitespace(
        formatAgreementFeeRuleLabel({
          currencyCode: "USD",
          kind: "fixed_fee",
          unit: "money",
          value: "150.00000000",
        }),
      ),
    ).toBe("Фиксированная комиссия 150,00 $");
  });

  it("degrades safely for malformed values instead of throwing", () => {
    expect(
      formatAgreementFeeRuleLabel({
        currencyCode: null,
        kind: "agent_fee",
        unit: "bps",
        value: "oops",
      }),
    ).toBe("Агентская комиссия —");

    expect(
      formatAgreementFeeRuleLabel({
        currencyCode: "USD",
        kind: "fixed_fee",
        unit: "money",
        value: "oops",
      }),
    ).toBe("Фиксированная комиссия —");
  });
});
