import { describe, expect, it } from "vitest";

import {
  canonicalizePricingFingerprintInput,
  computePricingFingerprint,
  type PricingFingerprintInput,
} from "../src/quotes/domain/pricing-fingerprint";
import { extractCrmPricingFingerprintSnapshot } from "../src/quotes/domain/pricing-trace";

function baseInput(): PricingFingerprintInput {
  return {
    commercialTerms: {
      agreementFeeBps: 25n,
      agreementVersionId: "agreement-v1",
      fixedFeeAmountMinor: 10_000n,
      fixedFeeCurrency: "RUB",
      quoteMarkupBps: 50n,
    },
    fromAmountMinor: 1_000_000n,
    fromCurrencyId: "rub",
    pricingMode: "explicit_route",
    routeTemplateId: "route-1",
    toAmountMinor: 10_000n,
    toCurrencyId: "usd",
  };
}

describe("computePricingFingerprint", () => {
  it("produces a stable hex digest", () => {
    const fingerprint = computePricingFingerprint(baseInput());

    expect(fingerprint).toMatch(/^[0-9a-f]{64}$/u);
  });

  it("is deterministic across calls", () => {
    const a = computePricingFingerprint(baseInput());
    const b = computePricingFingerprint(baseInput());

    expect(a).toBe(b);
  });

  it("normalizes bigint and string numeric inputs to the same fingerprint", () => {
    const bigintInput = baseInput();
    const stringInput: PricingFingerprintInput = {
      ...bigintInput,
      commercialTerms: {
        agreementFeeBps: "25",
        agreementVersionId: bigintInput.commercialTerms!.agreementVersionId,
        fixedFeeAmountMinor: "10000",
        fixedFeeCurrency: bigintInput.commercialTerms!.fixedFeeCurrency,
        quoteMarkupBps: "50",
      },
      fromAmountMinor: "1000000",
      toAmountMinor: "10000",
    };

    expect(computePricingFingerprint(bigintInput)).toBe(
      computePricingFingerprint(stringInput),
    );
  });

  it.each([
    {
      field: "fromAmountMinor",
      mutate: (i: PricingFingerprintInput) => ({
        ...i,
        fromAmountMinor: 1_500_000n,
      }),
    },
    {
      field: "toAmountMinor",
      mutate: (i: PricingFingerprintInput) => ({
        ...i,
        toAmountMinor: 15_000n,
      }),
    },
    {
      field: "fromCurrencyId",
      mutate: (i: PricingFingerprintInput) => ({ ...i, fromCurrencyId: "eur" }),
    },
    {
      field: "toCurrencyId",
      mutate: (i: PricingFingerprintInput) => ({ ...i, toCurrencyId: "eur" }),
    },
    {
      field: "pricingMode",
      mutate: (i: PricingFingerprintInput) => ({
        ...i,
        pricingMode: "auto_cross" as const,
      }),
    },
    {
      field: "routeTemplateId",
      mutate: (i: PricingFingerprintInput) => ({
        ...i,
        routeTemplateId: "route-2",
      }),
    },
    {
      field: "commercialTerms.agreementFeeBps",
      mutate: (i: PricingFingerprintInput) => ({
        ...i,
        commercialTerms: { ...i.commercialTerms!, agreementFeeBps: 30n },
      }),
    },
    {
      field: "commercialTerms.quoteMarkupBps",
      mutate: (i: PricingFingerprintInput) => ({
        ...i,
        commercialTerms: { ...i.commercialTerms!, quoteMarkupBps: 75n },
      }),
    },
    {
      field: "commercialTerms.fixedFeeAmountMinor",
      mutate: (i: PricingFingerprintInput) => ({
        ...i,
        commercialTerms: {
          ...i.commercialTerms!,
          fixedFeeAmountMinor: 20_000n,
        },
      }),
    },
    {
      field: "commercialTerms.fixedFeeCurrency",
      mutate: (i: PricingFingerprintInput) => ({
        ...i,
        commercialTerms: { ...i.commercialTerms!, fixedFeeCurrency: "USD" },
      }),
    },
    {
      field: "commercialTerms.agreementVersionId",
      mutate: (i: PricingFingerprintInput) => ({
        ...i,
        commercialTerms: {
          ...i.commercialTerms!,
          agreementVersionId: "agreement-v2",
        },
      }),
    },
  ])("changes when $field changes", ({ mutate }) => {
    const base = computePricingFingerprint(baseInput());
    const mutated = computePricingFingerprint(mutate(baseInput()));

    expect(mutated).not.toBe(base);
  });

  it("treats null commercialTerms distinctly from populated terms", () => {
    const withTerms = computePricingFingerprint(baseInput());
    const withoutTerms = computePricingFingerprint({
      ...baseInput(),
      commercialTerms: null,
    });

    expect(withoutTerms).not.toBe(withTerms);
  });

  it("canonical form has a stable key order (property-level)", () => {
    const canon = canonicalizePricingFingerprintInput(baseInput());
    expect(Object.keys(canon)).toEqual([
      "commercialTerms",
      "clientPricing",
      "fromAmountMinor",
      "fromCurrencyId",
      "pricingMode",
      "routeTemplateId",
      "toAmountMinor",
      "toCurrencyId",
    ]);
  });
});

describe("extractCrmPricingFingerprintSnapshot", () => {
  it("returns client, execution, and pnl snapshots when complete", () => {
    const clientSide = { sourceAmountMinor: "100" };
    const executionSide = { source: "treasury_inventory" };
    const pnl = { grossProfitMinor: "10" };

    expect(
      extractCrmPricingFingerprintSnapshot({
        metadata: {
          crmPricingSnapshot: {
            clientSide,
            executionSide,
            pnl,
          },
        },
      }),
    ).toEqual({
      clientSide,
      executionSide,
      pnl,
    });
  });

  it.each([
    {},
    { metadata: null },
    { metadata: { crmPricingSnapshot: null } },
    {
      metadata: {
        crmPricingSnapshot: {
          clientSide: {},
          executionSide: {},
        },
      },
    },
  ])("returns null for malformed pricing trace %#", (pricingTrace) => {
    expect(extractCrmPricingFingerprintSnapshot(pricingTrace)).toBeNull();
  });
});
