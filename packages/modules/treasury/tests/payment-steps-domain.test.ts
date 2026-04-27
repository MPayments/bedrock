import { describe, expect, it } from "vitest";

import { PaymentStep } from "../src/payment-steps/domain/payment-step";
import type { ArtifactRef } from "../src/payment-steps/domain/types";

const STEP_ID = "00000000-0000-4000-8000-000000000001";
const FROM_PARTY_ID = "00000000-0000-4000-8000-000000000101";
const TO_PARTY_ID = "00000000-0000-4000-8000-000000000102";
const FROM_REQUISITE_ID = "00000000-0000-4000-8000-000000000201";
const TO_REQUISITE_ID = "00000000-0000-4000-8000-000000000202";
const USD_ID = "00000000-0000-4000-8000-000000000301";
const EUR_ID = "00000000-0000-4000-8000-000000000302";
const DEAL_ID = "00000000-0000-4000-8000-000000000401";
const FIRST_ATTEMPT_ID = "00000000-0000-4000-8000-000000000501";
const SECOND_ATTEMPT_ID = "00000000-0000-4000-8000-000000000502";

const NOW = new Date("2026-04-24T10:00:00.000Z");
const SUBMITTED_AT = new Date("2026-04-24T10:05:00.000Z");
const OUTCOME_AT = new Date("2026-04-24T10:10:00.000Z");
const RETURNED_AT = new Date("2026-04-24T11:10:00.000Z");

function evidenceArtifact(overrides: Partial<ArtifactRef> = {}): ArtifactRef {
  return {
    fileAssetId: "00000000-0000-4000-8000-000000000601",
    purpose: "bank_confirmation",
    ...overrides,
  };
}

function createStep(
  overrides: Partial<Parameters<typeof PaymentStep.create>[0]> = {},
) {
  return PaymentStep.create(
    {
      dealId: DEAL_ID,
      fromAmountMinor: 10000n,
      fromCurrencyId: USD_ID,
      fromParty: {
        id: FROM_PARTY_ID,
        requisiteId: FROM_REQUISITE_ID,
      },
      id: STEP_ID,
      kind: "payout",
      planLegId: "plan-leg-1",
      purpose: "deal_leg",
      sequence: 1,
      sourceRef: `deal:${DEAL_ID}:plan-leg:plan-leg-1:payout:1`,
      toAmountMinor: 9200n,
      toCurrencyId: EUR_ID,
      toParty: {
        id: TO_PARTY_ID,
        requisiteId: TO_REQUISITE_ID,
      },
      ...overrides,
    },
    NOW,
  );
}

function submitFirstAttempt(step = createStep()) {
  return step.markPending(NOW).submit({
    attemptId: FIRST_ATTEMPT_ID,
    providerRef: "bank-ref-1",
    providerSnapshot: { status: "submitted" },
    submittedAt: SUBMITTED_AT,
  });
}

describe("PaymentStep domain", () => {
  it("creates a draft deal-leg payment step snapshot", () => {
    const snapshot = createStep().toSnapshot();

    expect(snapshot).toMatchObject({
      attempts: [],
      dealId: DEAL_ID,
      kind: "payout",
      origin: expect.objectContaining({
        planLegId: "plan-leg-1",
        sequence: 1,
        type: "deal_execution_leg",
      }),
      purpose: "deal_leg",
      sourceRef: `deal:${DEAL_ID}:plan-leg:plan-leg-1:payout:1`,
      state: "draft",
    });
  });

  it("rejects deal-origin steps without a plan leg id", () => {
    expect(() =>
      createStep({
        origin: {
          dealId: DEAL_ID,
          planLegId: null,
          routeSnapshotLegId: null,
          sequence: 1,
          treasuryOrderId: null,
          type: "deal_execution_leg",
        },
      }),
    ).toThrow(/deal context/u);
  });

  it("keeps FX outside the payment-step kind vocabulary", () => {
    expect(createStep().toSnapshot()).toMatchObject({
      kind: "payout",
      quoteId: null,
    });
  });

  it("allows route amendments until pending and rejects amendments once processing", () => {
    const pending = createStep().markPending(NOW).amend(
      {
        fromAmountMinor: 12000n,
        rate: { lockedSide: "in", value: "1.09" },
      },
      NOW,
    );

    expect(pending.toSnapshot()).toMatchObject({
      fromAmountMinor: 12000n,
      rate: { lockedSide: "in", value: "1.09" },
      state: "pending",
    });

    const processing = pending.submit({
      attemptId: FIRST_ATTEMPT_ID,
      submittedAt: SUBMITTED_AT,
    });

    expect(() =>
      processing.amend({ toAmountMinor: 13000n }, OUTCOME_AT),
    ).toThrow(/cannot be amended after processing starts/u);
  });

  it("appends retry attempts sequentially after a failed outcome", () => {
    const failed = submitFirstAttempt().confirm({
      failureReason: "provider rejected",
      outcome: "failed",
      outcomeAt: OUTCOME_AT,
    });

    expect(failed.toSnapshot()).toMatchObject({
      failureReason: "provider rejected",
      state: "failed",
    });
    expect(failed.toSnapshot().attempts).toHaveLength(1);
    expect(failed.toSnapshot().attempts[0]).toMatchObject({
      attemptNo: 1,
      outcome: "failed",
    });

    const retried = failed.submit({
      attemptId: SECOND_ATTEMPT_ID,
      providerRef: "bank-ref-2",
      submittedAt: RETURNED_AT,
    });

    expect(retried.toSnapshot().attempts).toMatchObject([
      { attemptNo: 1, id: FIRST_ATTEMPT_ID, outcome: "failed" },
      { attemptNo: 2, id: SECOND_ATTEMPT_ID, outcome: "pending" },
    ]);
    expect(retried.toSnapshot().state).toBe("processing");
  });

  it("allows completion without domain-level deal evidence policy", () => {
    const processing = submitFirstAttempt();

    const completed = processing.confirm({
      outcome: "settled",
      outcomeAt: OUTCOME_AT,
    });

    expect(completed.toSnapshot()).toMatchObject({
      completedAt: OUTCOME_AT,
      state: "completed",
    });
    expect(completed.toSnapshot().attempts[0]).toMatchObject({
      outcome: "settled",
      outcomeAt: OUTCOME_AT,
    });
  });

  it("allows non-beneficiary steps to complete without settlement evidence", () => {
    const processing = submitFirstAttempt(
      createStep({
        dealId: null,
        origin: {
          dealId: null,
          planLegId: null,
          routeSnapshotLegId: null,
          sequence: null,
          treasuryOrderId: null,
          type: "manual",
        },
        purpose: "standalone_payment",
        sourceRef: "manual:standalone:1",
      }),
    );

    const completed = processing.confirm({
      outcome: "settled",
      outcomeAt: OUTCOME_AT,
    });

    expect(completed.toSnapshot()).toMatchObject({
      artifacts: [],
      completedAt: OUTCOME_AT,
      state: "completed",
    });
  });

  it("requires a completed attempt before marking a step returned", () => {
    const processing = submitFirstAttempt();

    expect(() =>
      processing.confirm({
        outcome: "returned",
        outcomeAt: RETURNED_AT,
      }),
    ).toThrow(/require prior completion/u);

    const completed = processing.confirm({
      artifacts: [evidenceArtifact()],
      outcome: "settled",
      outcomeAt: OUTCOME_AT,
    });

    expect(() =>
      completed.recordReturn({
        id: "6d16baf2-0698-49ac-9324-7ad50964e841",
        returnedAt: new Date("2026-04-24T10:09:00.000Z"),
      }),
    ).toThrow(/cannot precede completion/u);

    const returned = completed.recordReturn({
      id: "6d16baf2-0698-49ac-9324-7ad50964e842",
      reason: "bank reversal",
      returnedAt: RETURNED_AT,
    });

    expect(returned.toSnapshot()).toMatchObject({
      failureReason: "bank reversal",
      state: "returned",
    });
    expect(returned.toSnapshot().returns[0]).toMatchObject({
      reason: "bank reversal",
      returnedAt: RETURNED_AT,
    });
  });

  it("rejects non-sequential attempt snapshots", () => {
    const snapshot = submitFirstAttempt().toSnapshot();

    expect(() =>
      PaymentStep.fromSnapshot({
        ...snapshot,
        attempts: [
          {
            ...snapshot.attempts[0]!,
            attemptNo: 2,
          },
        ],
      }),
    ).toThrow(/append-only and sequential/u);
  });
});
