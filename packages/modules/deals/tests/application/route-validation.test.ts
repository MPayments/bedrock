import { describe, expect, it } from "vitest";

import { validateDealRouteDefinition } from "../../src/domain/route-validation";

function createValidPaymentRouteInput() {
  return {
    costComponents: [],
    dealType: "payment" as const,
    legs: [
      {
        code: "leg-1",
        executionCounterpartyId: null,
        expectedFromAmountMinor: "100000",
        expectedRateDen: null,
        expectedRateNum: null,
        expectedToAmountMinor: "100000",
        fromCurrencyId: "00000000-0000-4000-8000-000000000101",
        fromParticipantCode: "customer",
        idx: 1,
        kind: "payout" as const,
        notes: null,
        settlementModel: "external_wire",
        toCurrencyId: "00000000-0000-4000-8000-000000000101",
        toParticipantCode: "beneficiary",
      },
    ],
    participants: [
      {
        code: "customer",
        displayNameSnapshot: "Customer A",
        metadata: {},
        partyId: "00000000-0000-4000-8000-000000000001",
        partyKind: "customer" as const,
        requisiteId: null,
        role: "source_customer",
        sequence: 1,
      },
      {
        code: "beneficiary",
        displayNameSnapshot: "Beneficiary D",
        metadata: {},
        partyId: "00000000-0000-4000-8000-000000000002",
        partyKind: "counterparty" as const,
        requisiteId: null,
        role: "destination_beneficiary",
        sequence: 2,
      },
    ],
  };
}

describe("route validation", () => {
  it("accepts a connected payment route with a payout leg", () => {
    const issues = validateDealRouteDefinition(createValidPaymentRouteInput());

    expect(issues).toEqual([]);
  });

  it("requires payment routes to include a payout leg", () => {
    const input = createValidPaymentRouteInput();
    input.legs = [
      {
        ...input.legs[0],
        kind: "collection",
      },
    ];

    const issues = validateDealRouteDefinition(input);

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "route.payment_payout_missing",
          severity: "error",
        }),
      ]),
    );
  });

  it("requires leg-bound basis components to reference a leg", () => {
    const input = createValidPaymentRouteInput();
    input.costComponents = [
      {
        basisType: "leg_from_amount",
        bps: "10",
        classification: "expense",
        code: "provider-fee",
        currencyId: "00000000-0000-4000-8000-000000000101",
        family: "provider_fee",
        fixedAmountMinor: null,
        formulaType: "bps",
        includedInClientRate: false,
        legCode: null,
        manualAmountMinor: null,
        notes: null,
        perMillion: null,
        roundingMode: "half_up",
        sequence: 1,
      },
    ];

    const issues = validateDealRouteDefinition(input);

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "component.leg_required",
          severity: "error",
        }),
      ]),
    );
  });
});
