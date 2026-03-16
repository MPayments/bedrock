import { describe, expect, it } from "vitest";

import {
  amountMinorSchema,
  amountValueSchema,
  minorToAmountString,
  normalizeMajorAmountInput,
  parseMinorAmount,
  parseMinorAmountOrZero,
  resolveCurrencyPrecision,
  signedMinorAmountSchema,
  toMinorAmountString,
} from "@bedrock/shared/money";

describe("money helpers", () => {
  it("resolves currency precision from Intl metadata", () => {
    expect(resolveCurrencyPrecision("USD")).toBe(2);
    expect(resolveCurrencyPrecision("JPY")).toBe(0);
    expect(resolveCurrencyPrecision("BHD")).toBe(3);
  });

  it("converts major amounts to minor amounts", () => {
    expect(toMinorAmountString("1000.50", "USD")).toBe("100050");
    expect(toMinorAmountString("-10.25", "USD")).toBe("-1025");
    expect(toMinorAmountString("0", "JPY")).toBe("0");

    expect(() => toMinorAmountString("1.2345", "BHD")).toThrow(
      "amount has too many fraction digits for BHD: max 3",
    );
    expect(() =>
      toMinorAmountString("0", "USD", { requirePositive: true }),
    ).toThrow("amount must be positive");
  });

  it("converts minor amounts to major strings", () => {
    expect(minorToAmountString("123456", { currency: "BHD" })).toBe("123.456");
    expect(minorToAmountString(-1050n, { currency: "USD" })).toBe("-10.5");
    expect(minorToAmountString(1200n, { precision: 3 })).toBe("1.2");
  });

  it("normalizes major amount input and supports localized messages", () => {
    expect(normalizeMajorAmountInput("0010.50", "USD")).toBe("10.5");
    expect(normalizeMajorAmountInput("-000.00", "USD")).toBe("0");
    expect(() =>
      normalizeMajorAmountInput("abc", "USD", {
        invalidNumberMessage: "invalid amount",
      }),
    ).toThrow("invalid amount");
    expect(() =>
      normalizeMajorAmountInput("1.001", "USD", {
        tooManyFractionDigitsMessage: ({ currency, precision }) =>
          `${currency}:${precision}`,
      }),
    ).toThrow("USD:2");
  });

  it("normalizes shared money schemas", () => {
    expect(amountValueSchema.parse("0010.500")).toBe("10.5");
    expect(amountMinorSchema.parse("001250")).toBe("1250");
    expect(signedMinorAmountSchema.parse("-250")).toBe(-250n);

    expect(() => amountMinorSchema.parse("0")).toThrow(
      "amountMinor must be positive",
    );
    expect(() => signedMinorAmountSchema.parse("0")).toThrow(
      "amountMinor must be non-zero",
    );
  });

  it("parses minor amounts with nullable and zero-default variants", () => {
    expect(parseMinorAmount("1250")).toBe(1250n);
    expect(parseMinorAmount("bad")).toBeNull();
    expect(parseMinorAmountOrZero("1250")).toBe(1250n);
    expect(parseMinorAmountOrZero("bad")).toBe(0n);
  });
});
