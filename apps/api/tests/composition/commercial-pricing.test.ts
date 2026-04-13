import { describe, expect, it } from "vitest";

import { extractAgreementCommercialDefaults } from "../../src/composition/commercial-pricing";

function createAgreement(feeRules: Array<{
  kind: "agent_fee" | "fixed_fee";
  value: string;
  currencyCode?: string | null;
}>) {
  return {
    id: "agreement-1",
    customerId: "customer-1",
    organizationId: "organization-1",
    organizationRequisiteId: "requisite-1",
    isActive: true,
    createdAt: new Date("2026-04-01T00:00:00.000Z"),
    updatedAt: new Date("2026-04-01T00:00:00.000Z"),
    currentVersion: {
      id: "agreement-version-1",
      versionNumber: 1,
      contractNumber: null,
      contractDate: null,
      createdAt: new Date("2026-04-01T00:00:00.000Z"),
      updatedAt: new Date("2026-04-01T00:00:00.000Z"),
      parties: [],
      feeRules,
    },
  } as const;
}

describe("commercial pricing defaults", () => {
  it("rounds decimal agreement fee bps strings before converting to bigint", () => {
    const defaults = extractAgreementCommercialDefaults({
      agreement: createAgreement([
        {
          kind: "agent_fee",
          value: "100.00000000",
        },
      ]) as any,
      fallbackFixedFeeCurrency: "USD",
    });

    expect(defaults).toEqual({
      agreementVersionId: "agreement-version-1",
      agreementFeeBps: 100n,
      fixedFeeAmount: null,
      fixedFeeCurrency: null,
    });
  });

  it("does not emit fixed fee currency when agreement has no fixed fee", () => {
    const defaults = extractAgreementCommercialDefaults({
      agreement: createAgreement([
        {
          kind: "agent_fee",
          value: "125",
        },
      ]) as any,
      fallbackFixedFeeCurrency: "USD",
    });

    expect(defaults).toEqual({
      agreementVersionId: "agreement-version-1",
      agreementFeeBps: 125n,
      fixedFeeAmount: null,
      fixedFeeCurrency: null,
    });
  });

  it("uses fallback currency only when a fixed fee exists without explicit currency", () => {
    const defaults = extractAgreementCommercialDefaults({
      agreement: createAgreement([
        {
          kind: "fixed_fee",
          value: "10.00",
          currencyCode: null,
        },
      ]) as any,
      fallbackFixedFeeCurrency: "EUR",
    });

    expect(defaults).toEqual({
      agreementVersionId: "agreement-version-1",
      agreementFeeBps: 0n,
      fixedFeeAmount: "10.00",
      fixedFeeCurrency: "EUR",
    });
  });
});
