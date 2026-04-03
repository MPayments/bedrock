import { describe, expect, it } from "vitest";

import {
  buildDealOperationalState,
  listRequiredDealCapabilityKinds,
} from "../../src/domain/operational-state";

function createExecutionLeg(
  idx: number,
  kind: "collect" | "payout",
  state: "pending" | "ready" | "done",
) {
  return {
    id: `leg-${idx}`,
    idx,
    kind,
    operationRefs: [],
    state,
  };
}

describe("deal operational state", () => {
  it("maps required capabilities by deal type", () => {
    expect(
      listRequiredDealCapabilityKinds({
        common: {
          applicantCounterpartyId: null,
          customerNote: null,
          requestedExecutionDate: null,
        },
        externalBeneficiary: {
          bankInstructionSnapshot: null,
          beneficiaryCounterpartyId: null,
          beneficiarySnapshot: null,
        },
        incomingReceipt: {
          contractNumber: null,
          expectedAmount: null,
          expectedAt: null,
          expectedCurrencyId: null,
          invoiceNumber: null,
          payerCounterpartyId: null,
          payerSnapshot: null,
        },
        moneyRequest: {
          purpose: null,
          sourceAmount: null,
          sourceCurrencyId: "currency-1",
          targetCurrencyId: "currency-2",
        },
        settlementDestination: {
          bankInstructionSnapshot: null,
          mode: null,
          requisiteId: null,
        },
        type: "currency_transit",
      }),
    ).toEqual(["can_collect", "can_fx", "can_transit", "can_payout"]);
  });

  it("defaults missing capability rows to pending", () => {
    const operationalState = buildDealOperationalState({
      calculationId: null,
      calculationLines: [],
      capabilityStates: [],
      executionPlan: [
        createExecutionLeg(1, "collect", "pending"),
        createExecutionLeg(2, "payout", "pending"),
      ],
      intake: {
        common: {
          applicantCounterpartyId: "applicant-1",
          customerNote: null,
          requestedExecutionDate: new Date("2026-04-05T00:00:00.000Z"),
        },
        externalBeneficiary: {
          bankInstructionSnapshot: null,
          beneficiaryCounterpartyId: null,
          beneficiarySnapshot: null,
        },
        incomingReceipt: {
          contractNumber: null,
          expectedAmount: null,
          expectedAt: null,
          expectedCurrencyId: null,
          invoiceNumber: null,
          payerCounterpartyId: null,
          payerSnapshot: null,
        },
        moneyRequest: {
          purpose: "Payment",
          sourceAmount: "100.00",
          sourceCurrencyId: "currency-1",
          targetCurrencyId: null,
        },
        settlementDestination: {
          bankInstructionSnapshot: null,
          mode: null,
          requisiteId: null,
        },
        type: "payment",
      },
      participants: [
        {
          counterpartyId: "applicant-1",
          customerId: null,
          displayName: "Applicant",
          id: "participant-applicant",
          organizationId: null,
          role: "applicant",
        },
        {
          counterpartyId: null,
          customerId: null,
          displayName: "Internal entity",
          id: "participant-internal",
          organizationId: "org-1",
          role: "internal_entity",
        },
      ],
      sectionCompleteness: [],
      status: "submitted",
      updatedAt: new Date("2026-04-01T12:00:00.000Z"),
    });

    expect(operationalState.capabilities).toEqual([
      expect.objectContaining({
        kind: "can_collect",
        reasonCode: "capability_missing",
        status: "pending",
      }),
      expect.objectContaining({
        kind: "can_payout",
        reasonCode: "capability_missing",
        status: "pending",
      }),
    ]);
  });

  it("keeps reserved positions as not applicable and derives fee/spread positions", () => {
    const operationalState = buildDealOperationalState({
      calculationId: "calc-1",
      calculationLines: [
        {
          amountMinor: "1200",
          currencyId: "currency-1",
          kind: "fee_revenue",
          updatedAt: new Date("2026-04-01T11:00:00.000Z"),
        },
        {
          amountMinor: "450",
          currencyId: "currency-1",
          kind: "spread_revenue",
          updatedAt: new Date("2026-04-01T11:00:00.000Z"),
        },
      ],
      capabilityStates: [],
      executionPlan: [
        createExecutionLeg(1, "collect", "done"),
        createExecutionLeg(2, "payout", "ready"),
      ],
      intake: {
        common: {
          applicantCounterpartyId: "applicant-1",
          customerNote: null,
          requestedExecutionDate: new Date("2026-04-05T00:00:00.000Z"),
        },
        externalBeneficiary: {
          bankInstructionSnapshot: null,
          beneficiaryCounterpartyId: null,
          beneficiarySnapshot: null,
        },
        incomingReceipt: {
          contractNumber: null,
          expectedAmount: null,
          expectedAt: null,
          expectedCurrencyId: null,
          invoiceNumber: null,
          payerCounterpartyId: null,
          payerSnapshot: null,
        },
        moneyRequest: {
          purpose: "Payment",
          sourceAmount: "100.00",
          sourceCurrencyId: "currency-1",
          targetCurrencyId: null,
        },
        settlementDestination: {
          bankInstructionSnapshot: null,
          mode: null,
          requisiteId: null,
        },
        type: "payment",
      },
      participants: [
        {
          counterpartyId: "applicant-1",
          customerId: null,
          displayName: "Applicant",
          id: "participant-applicant",
          organizationId: null,
          role: "applicant",
        },
        {
          counterpartyId: null,
          customerId: null,
          displayName: "Internal entity",
          id: "participant-internal",
          organizationId: "org-1",
          role: "internal_entity",
        },
      ],
      sectionCompleteness: [],
      status: "awaiting_payment",
      updatedAt: new Date("2026-04-01T12:00:00.000Z"),
    });

    expect(
      operationalState.positions.find((position) => position.kind === "fee_revenue"),
    ).toEqual(
      expect.objectContaining({
        amountMinor: "1200",
        state: "ready",
      }),
    );
    expect(
      operationalState.positions.find((position) => position.kind === "spread_revenue"),
    ).toEqual(
      expect.objectContaining({
        amountMinor: "450",
        state: "ready",
      }),
    );
    expect(
      operationalState.positions.find(
        (position) => position.kind === "intercompany_due_from",
      ),
    ).toEqual(
      expect.objectContaining({
        state: "not_applicable",
      }),
    );
    expect(
      operationalState.positions.find((position) => position.kind === "suspense"),
    ).toEqual(
      expect.objectContaining({
        state: "not_applicable",
      }),
    );
  });
});
