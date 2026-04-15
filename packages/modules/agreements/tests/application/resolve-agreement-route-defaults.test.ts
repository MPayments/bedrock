import { describe, expect, it } from "vitest";

import { resolveAgreementRouteDefaults } from "../../src/application/shared/route-policy";

function createAgreementDetails() {
  const now = new Date("2026-04-14T00:00:00.000Z");

  return {
    id: "00000000-0000-4000-8000-000000000010",
    customerId: "00000000-0000-4000-8000-000000000001",
    organizationId: "00000000-0000-4000-8000-000000000002",
    organizationRequisiteId: "00000000-0000-4000-8000-000000000003",
    isActive: true,
    createdAt: now,
    updatedAt: now,
    currentVersion: {
      id: "00000000-0000-4000-8000-000000000011",
      versionNumber: 1,
      contractNumber: "AG-001",
      contractDate: now,
      feeRules: [],
      parties: [],
      routePolicies: [
        {
          id: "00000000-0000-4000-8000-000000000101",
          agreementVersionId: "00000000-0000-4000-8000-000000000011",
          sequence: 1,
          dealType: "payment" as const,
          sourceCurrencyId: null,
          sourceCurrencyCode: null,
          targetCurrencyId: null,
          targetCurrencyCode: null,
          defaultMarkupBps: "150",
          defaultWireFeeAmountMinor: null,
          defaultWireFeeCurrencyId: null,
          defaultWireFeeCurrencyCode: null,
          defaultSubAgentCommissionUnit: null,
          defaultSubAgentCommissionBps: null,
          defaultSubAgentCommissionAmountMinor: null,
          defaultSubAgentCommissionCurrencyId: null,
          defaultSubAgentCommissionCurrencyCode: null,
          approvalThresholdAmountMinor: null,
          approvalThresholdCurrencyId: null,
          approvalThresholdCurrencyCode: null,
          quoteValiditySeconds: 900,
          templateLinks: [],
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "00000000-0000-4000-8000-000000000102",
          agreementVersionId: "00000000-0000-4000-8000-000000000011",
          sequence: 2,
          dealType: "payment" as const,
          sourceCurrencyId: "00000000-0000-4000-8000-000000000201",
          sourceCurrencyCode: "RUB",
          targetCurrencyId: "00000000-0000-4000-8000-000000000202",
          targetCurrencyCode: "USD",
          defaultMarkupBps: "180",
          defaultWireFeeAmountMinor: "1500",
          defaultWireFeeCurrencyId: "00000000-0000-4000-8000-000000000202",
          defaultWireFeeCurrencyCode: "USD",
          defaultSubAgentCommissionUnit: null,
          defaultSubAgentCommissionBps: null,
          defaultSubAgentCommissionAmountMinor: null,
          defaultSubAgentCommissionCurrencyId: null,
          defaultSubAgentCommissionCurrencyCode: null,
          approvalThresholdAmountMinor: null,
          approvalThresholdCurrencyId: null,
          approvalThresholdCurrencyCode: null,
          quoteValiditySeconds: 600,
          templateLinks: [
            {
              id: "00000000-0000-4000-8000-000000000301",
              routeTemplateId: "00000000-0000-4000-8000-000000000401",
              sequence: 1,
              isDefault: true,
              createdAt: now,
              updatedAt: now,
            },
          ],
          createdAt: now,
          updatedAt: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
    },
  };
}

describe("resolve agreement route defaults", () => {
  it("prefers the most specific corridor policy for the same deal type", () => {
    const result = resolveAgreementRouteDefaults({
      agreement: createAgreementDetails(),
      dealType: "payment",
      sourceCurrencyId: "00000000-0000-4000-8000-000000000201",
      targetCurrencyId: "00000000-0000-4000-8000-000000000202",
    });

    expect(result.policy?.sequence).toBe(2);
    expect(result.policy?.defaultMarkupBps).toBe("180");
    expect(result.policy?.templateLinks[0]?.isDefault).toBe(true);
  });

  it("falls back to the generic policy when corridor-specific match is absent", () => {
    const result = resolveAgreementRouteDefaults({
      agreement: createAgreementDetails(),
      dealType: "payment",
      sourceCurrencyId: "00000000-0000-4000-8000-000000000201",
      targetCurrencyId: "00000000-0000-4000-8000-000000000299",
    });

    expect(result.policy?.sequence).toBe(1);
    expect(result.policy?.defaultMarkupBps).toBe("150");
  });
});
