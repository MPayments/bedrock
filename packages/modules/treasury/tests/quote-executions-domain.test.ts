import { describe, expect, it } from "vitest";

import { QuoteExecution } from "../src/quote-executions/domain/quote-execution";

const EXECUTION_ID = "00000000-0000-4000-8000-000000000001";
const DEAL_ID = "00000000-0000-4000-8000-000000000002";
const QUOTE_ID = "00000000-0000-4000-8000-000000000003";
const DEBIT_PARTY_ID = "00000000-0000-4000-8000-000000000101";
const CREDIT_PARTY_ID = "00000000-0000-4000-8000-000000000102";
const DEBIT_REQUISITE_ID = "00000000-0000-4000-8000-000000000201";
const NEXT_DEBIT_REQUISITE_ID = "00000000-0000-4000-8000-000000000202";
const CREDIT_REQUISITE_ID = "00000000-0000-4000-8000-000000000203";
const RUB_ID = "00000000-0000-4000-8000-000000000301";
const AED_ID = "00000000-0000-4000-8000-000000000302";
const NOW = new Date("2026-04-30T10:00:00.000Z");

function createExecution() {
  return QuoteExecution.create(
    {
      dealId: DEAL_ID,
      executionParties: {
        creditParty: {
          displayName: "Credit organization",
          entityKind: "organization",
          id: CREDIT_PARTY_ID,
          requisiteId: CREDIT_REQUISITE_ID,
        },
        debitParty: {
          displayName: "Debit organization",
          entityKind: "organization",
          id: DEBIT_PARTY_ID,
          requisiteId: DEBIT_REQUISITE_ID,
        },
      },
      fromAmountMinor: 10000n,
      fromCurrencyId: RUB_ID,
      id: EXECUTION_ID,
      origin: {
        dealId: DEAL_ID,
        planLegId: "plan-leg-1",
        routeSnapshotLegId: null,
        sequence: 1,
        treasuryOrderId: null,
        type: "deal_execution_leg",
      },
      quoteId: QUOTE_ID,
      rateDen: 10000n,
      rateNum: 1000n,
      sourceRef: `deal:${DEAL_ID}:plan-leg:plan-leg-1:quote-execution`,
      toAmountMinor: 1000n,
      toCurrencyId: AED_ID,
    },
    NOW,
  ).markPending(NOW);
}

describe("QuoteExecution domain", () => {
  it("allows settlement party amendments before submission", () => {
    const amended = createExecution().amendExecutionParties({
      executionParties: {
        creditParty: {
          displayName: "Credit organization",
          entityKind: "organization",
          id: CREDIT_PARTY_ID,
          requisiteId: CREDIT_REQUISITE_ID,
        },
        debitParty: {
          displayName: "Debit organization",
          entityKind: "organization",
          id: DEBIT_PARTY_ID,
          requisiteId: NEXT_DEBIT_REQUISITE_ID,
        },
      },
      updatedAt: new Date("2026-04-30T10:05:00.000Z"),
    });

    expect(amended.toSnapshot().executionParties?.debitParty).toMatchObject({
      id: DEBIT_PARTY_ID,
      requisiteId: NEXT_DEBIT_REQUISITE_ID,
    });
  });

  it("rejects settlement party amendments after submission", () => {
    const processing = createExecution().submit({
      providerRef: "ticket-1",
      submittedAt: new Date("2026-04-30T10:10:00.000Z"),
    });

    expect(() =>
      processing.amendExecutionParties({
        executionParties: processing.toSnapshot().executionParties!,
        updatedAt: new Date("2026-04-30T10:11:00.000Z"),
      }),
    ).toThrow(/cannot be amended/u);
  });
});
