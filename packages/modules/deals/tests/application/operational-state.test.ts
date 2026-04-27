import { describe, expect, it } from "vitest";

import { buildDealOperationalState } from "../../src/domain/operational-state";

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
  it("derives execution-backed positions directly from the leg states", () => {
    const operationalState = buildDealOperationalState({
      calculationId: null,
      calculationLines: [],
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
      sectionCompleteness: [],
      status: "submitted",
      updatedAt: new Date("2026-04-01T12:00:00.000Z"),
    });

    expect(operationalState.positions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "customer_receivable",
          reasonCode: "execution_pending",
          state: "pending",
        }),
        expect.objectContaining({
          kind: "downstream_payable",
          reasonCode: "execution_pending",
          state: "pending",
        }),
      ]),
    );
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
