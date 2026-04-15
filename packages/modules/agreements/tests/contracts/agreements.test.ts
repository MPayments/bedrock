import { describe, expect, it } from "vitest";

import {
  CreateAgreementInputSchema,
  CreateAgreementFeeRuleInputSchema,
  AgreementRoutePolicyInputSchema,
} from "../../src/contracts";

describe("agreements contracts", () => {
  it("accepts bps fee rules without currency", () => {
    const parsed = CreateAgreementFeeRuleInputSchema.parse({
      kind: "agent_fee",
      unit: "bps",
      value: "125",
    });

    expect(parsed).toEqual({
      kind: "agent_fee",
      unit: "bps",
      value: "125",
    });
  });

  it("rejects money fee rules without currency", () => {
    expect(() =>
      CreateAgreementFeeRuleInputSchema.parse({
        kind: "fixed_fee",
        unit: "money",
        value: "25.50",
      }),
    ).toThrow("currencyId is required for money fee rules");
  });

  it("rejects duplicate fee rule kinds on agreement create", () => {
    expect(() =>
      CreateAgreementInputSchema.parse({
        customerId: "00000000-0000-4000-8000-000000000001",
        organizationId: "00000000-0000-4000-8000-000000000002",
        organizationRequisiteId: "00000000-0000-4000-8000-000000000003",
        feeRules: [
          {
            kind: "agent_fee",
            unit: "bps",
            value: "100",
          },
          {
            kind: "agent_fee",
            unit: "bps",
            value: "200",
          },
        ],
      }),
    ).toThrow("Duplicate fee rule kind: agent_fee");
  });

  it("accepts route policy defaults with a published-template-compatible shape", () => {
    const parsed = AgreementRoutePolicyInputSchema.parse({
      sequence: 1,
      dealType: "payment",
      defaultMarkupBps: "150",
      defaultWireFeeAmountMinor: "1500",
      defaultWireFeeCurrencyId: "00000000-0000-4000-8000-000000000010",
      defaultSubAgentCommissionUnit: "bps",
      defaultSubAgentCommissionBps: "70",
      quoteValiditySeconds: 900,
      templateLinks: [
        {
          routeTemplateId: "00000000-0000-4000-8000-000000000011",
          sequence: 1,
          isDefault: true,
        },
      ],
    });

    expect(parsed.defaultMarkupBps).toBe("150");
    expect(parsed.defaultSubAgentCommissionUnit).toBe("bps");
  });

  it("rejects inconsistent money defaults inside route policies", () => {
    expect(() =>
      AgreementRoutePolicyInputSchema.parse({
        sequence: 1,
        dealType: "payment",
        defaultWireFeeAmountMinor: "100",
      }),
    ).toThrow(
      "defaultWireFeeAmountMinor and defaultWireFeeCurrencyId must be provided together",
    );
  });
});
