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

function createStep() {
  return PaymentStep.create(
    {
      dealId: DEAL_ID,
      dealLegIdx: 0,
      dealLegRole: "payout",
      fromAmountMinor: 10000n,
      fromCurrencyId: USD_ID,
      fromParty: {
        id: FROM_PARTY_ID,
        requisiteId: FROM_REQUISITE_ID,
      },
      id: STEP_ID,
      kind: "payout",
      purpose: "deal_leg",
      toAmountMinor: 9200n,
      toCurrencyId: EUR_ID,
      toParty: {
        id: TO_PARTY_ID,
        requisiteId: TO_REQUISITE_ID,
      },
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
      dealLegIdx: 0,
      dealLegRole: "payout",
      kind: "payout",
      purpose: "deal_leg",
      state: "draft",
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

  it("requires settlement evidence before completing a step", () => {
    const processing = submitFirstAttempt();

    expect(() =>
      processing.confirm({
        outcome: "settled",
        outcomeAt: OUTCOME_AT,
      }),
    ).toThrow(/settlement evidence/u);

    const completed = processing.confirm({
      artifacts: [evidenceArtifact()],
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
      completed.confirm({
        outcome: "returned",
        outcomeAt: new Date("2026-04-24T10:09:00.000Z"),
      }),
    ).toThrow(/completed attempt before return/u);

    const returned = completed.confirm({
      failureReason: "bank reversal",
      outcome: "returned",
      outcomeAt: RETURNED_AT,
    });

    expect(returned.toSnapshot()).toMatchObject({
      failureReason: "bank reversal",
      state: "returned",
    });
    expect(returned.toSnapshot().attempts[0]).toMatchObject({
      outcome: "returned",
      outcomeAt: RETURNED_AT,
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
