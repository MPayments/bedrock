import { describe, expect, it } from "vitest";

import { validateDealRouteTemplateDefinition } from "../../src/domain/route-template-validation";

function createValidTemplateInput() {
  return {
    costComponents: [],
    dealType: "payment" as const,
    legs: [
      {
        code: "collect",
        executionCounterpartyId: null,
        expectedFromAmountMinor: "100000",
        expectedRateDen: null,
        expectedRateNum: null,
        expectedToAmountMinor: "100000",
        fromCurrencyId: "00000000-0000-4000-8000-000000000006",
        fromParticipantCode: "customer",
        idx: 1,
        kind: "collection" as const,
        notes: null,
        settlementModel: "incoming_receipt",
        toCurrencyId: "00000000-0000-4000-8000-000000000006",
        toParticipantCode: "ops",
      },
      {
        code: "payout",
        executionCounterpartyId: null,
        expectedFromAmountMinor: "100000",
        expectedRateDen: null,
        expectedRateNum: null,
        expectedToAmountMinor: "100000",
        fromCurrencyId: "00000000-0000-4000-8000-000000000006",
        fromParticipantCode: "ops",
        idx: 2,
        kind: "payout" as const,
        notes: null,
        settlementModel: "external_wire",
        toCurrencyId: "00000000-0000-4000-8000-000000000006",
        toParticipantCode: "beneficiary",
      },
    ],
    participants: [
      {
        bindingKind: "deal_customer" as const,
        code: "customer",
        displayNameTemplate: "Customer",
        metadata: {},
        partyId: null,
        partyKind: "customer" as const,
        requisiteId: null,
        role: "source_customer",
        sequence: 1,
      },
      {
        bindingKind: "fixed_party" as const,
        code: "ops",
        displayNameTemplate: "Ops",
        metadata: {},
        partyId: "00000000-0000-4000-8000-000000000020",
        partyKind: "organization" as const,
        requisiteId: null,
        role: "treasury_hub",
        sequence: 2,
      },
      {
        bindingKind: "deal_beneficiary" as const,
        code: "beneficiary",
        displayNameTemplate: "Beneficiary",
        metadata: {},
        partyId: null,
        partyKind: "counterparty" as const,
        requisiteId: null,
        role: "destination_beneficiary",
        sequence: 3,
      },
    ],
  };
}

describe("route template validation", () => {
  it("accepts a payment template with placeholders and fixed internal party", () => {
    const issues = validateDealRouteTemplateDefinition(createValidTemplateInput());

    expect(issues).toEqual([]);
  });

  it("requires fixed_party participants to provide partyId", () => {
    const input = createValidTemplateInput();
    input.participants[1] = {
      ...input.participants[1],
      partyId: null,
    };

    const issues = validateDealRouteTemplateDefinition(input);

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "template.participant.fixed_party_missing",
        }),
      ]),
    );
  });

  it("requires deal_customer bindings to use customer party kind", () => {
    const input = createValidTemplateInput();
    input.participants[0] = {
      ...input.participants[0],
      partyKind: "counterparty",
    };

    const issues = validateDealRouteTemplateDefinition(input);

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "template.participant.customer_binding_kind_mismatch",
        }),
      ]),
    );
  });
});
