import { describe, expect, it } from "vitest";

import {
  buildAmendRouteBody,
  deriveStepPrimaryAction,
  latestStepAttempt,
  stepBadgeVariant,
  STEP_STATE_LABELS,
} from "@/features/treasury/steps/lib/step-helpers";
import type {
  FinanceDealPaymentStep,
  FinanceDealPaymentStepAttempt,
} from "@/features/treasury/deals/lib/queries";

function makeValues(): Parameters<typeof buildAmendRouteBody>[0]["before"] {
  return {
    fromAmountMinor: "1000",
    fromCurrencyId: "00000000-0000-4000-8000-000000000001",
    fromRequisiteId: null,
    rate: null,
    toAmountMinor: "1000",
    toCurrencyId: "00000000-0000-4000-8000-000000000001",
    toRequisiteId: null,
  };
}

describe("stepBadgeVariant", () => {
  it("returns default for completed (strong positive)", () => {
    expect(stepBadgeVariant("completed")).toBe("default");
  });

  it("returns destructive for failed and returned", () => {
    expect(stepBadgeVariant("failed")).toBe("destructive");
    expect(stepBadgeVariant("returned")).toBe("destructive");
  });

  it("returns secondary for skipped/cancelled (neutral terminal)", () => {
    expect(stepBadgeVariant("cancelled")).toBe("secondary");
    expect(stepBadgeVariant("skipped")).toBe("secondary");
  });

  it("returns outline for mutable in-flight states", () => {
    expect(stepBadgeVariant("draft")).toBe("outline");
    expect(stepBadgeVariant("scheduled")).toBe("outline");
    expect(stepBadgeVariant("pending")).toBe("outline");
    expect(stepBadgeVariant("processing")).toBe("outline");
  });

  it("has a label for every state", () => {
    const states = [
      "draft",
      "scheduled",
      "pending",
      "processing",
      "completed",
      "failed",
      "returned",
      "cancelled",
      "skipped",
    ] as const;
    for (const state of states) {
      expect(STEP_STATE_LABELS[state]).toBeTruthy();
    }
  });
});

describe("deriveStepPrimaryAction", () => {
  it("returns submit for pending and failed (retry)", () => {
    expect(deriveStepPrimaryAction("pending")).toBe("submit");
    expect(deriveStepPrimaryAction("failed")).toBe("submit");
  });

  it("returns confirm while processing", () => {
    expect(deriveStepPrimaryAction("processing")).toBe("confirm");
  });

  it("returns null for terminal states", () => {
    expect(deriveStepPrimaryAction("completed")).toBeNull();
    expect(deriveStepPrimaryAction("returned")).toBeNull();
    expect(deriveStepPrimaryAction("cancelled")).toBeNull();
    expect(deriveStepPrimaryAction("skipped")).toBeNull();
  });

  it("returns null for non-actionable draft/scheduled", () => {
    // The workbench publishes steps to treasurer as `pending`; steps still
    // in `draft`/`scheduled` belong to the plan stage and shouldn't carry a
    // primary action yet.
    expect(deriveStepPrimaryAction("draft")).toBeNull();
    expect(deriveStepPrimaryAction("scheduled")).toBeNull();
  });
});

describe("buildAmendRouteBody", () => {
  it("returns null when nothing changed", () => {
    const base = makeValues();
    expect(buildAmendRouteBody({ before: base, after: base })).toBeNull();
  });

  it("includes only the fields that actually changed", () => {
    const before = makeValues();
    const after = { ...before, fromAmountMinor: "2000" };
    expect(buildAmendRouteBody({ before, after })).toEqual({
      fromAmountMinor: "2000",
    });
  });

  it("wraps requisite changes in fromParty/toParty objects", () => {
    const before = makeValues();
    const after = {
      ...before,
      fromRequisiteId: "00000000-0000-4000-8000-000000000020",
      toRequisiteId: "00000000-0000-4000-8000-000000000021",
    };
    expect(buildAmendRouteBody({ before, after })).toEqual({
      fromParty: { requisiteId: "00000000-0000-4000-8000-000000000020" },
      toParty: { requisiteId: "00000000-0000-4000-8000-000000000021" },
    });
  });

  it("detects rate changes by value-equality", () => {
    const before = { ...makeValues(), rate: null };
    const after = {
      ...makeValues(),
      rate: { value: "1.25", lockedSide: "in" as const },
    };
    expect(buildAmendRouteBody({ before, after })).toEqual({
      rate: { value: "1.25", lockedSide: "in" },
    });
  });

  it("detects rate resets back to null", () => {
    const before = {
      ...makeValues(),
      rate: { value: "1.25", lockedSide: "in" as const },
    };
    const after = { ...makeValues(), rate: null };
    expect(buildAmendRouteBody({ before, after })).toEqual({ rate: null });
  });
});

describe("latestStepAttempt", () => {
  function makeStep(
    attempts: FinanceDealPaymentStepAttempt[],
  ): FinanceDealPaymentStep {
    return {
      artifacts: [],
      attempts,
      completedAt: null,
      createdAt: "2026-04-01T00:00:00.000Z",
      dealId: null,
      dealLegIdx: null,
      dealLegRole: null,
      failureReason: null,
      fromAmountMinor: null,
      fromCurrencyId: "00000000-0000-4000-8000-000000000001",
      fromParty: {
        id: "00000000-0000-4000-8000-000000000002",
        requisiteId: null,
      },
      id: "00000000-0000-4000-8000-000000000010",
      kind: "payin",
      postings: [],
      purpose: "standalone_payment",
      rate: null,
      scheduledAt: null,
      state: "pending",
      submittedAt: null,
      toAmountMinor: null,
      toCurrencyId: "00000000-0000-4000-8000-000000000001",
      toParty: {
        id: "00000000-0000-4000-8000-000000000003",
        requisiteId: null,
      },
      treasuryBatchId: null,
      updatedAt: "2026-04-01T00:00:00.000Z",
    };
  }

  function makeAttempt(
    attemptNo: number,
    outcome: FinanceDealPaymentStepAttempt["outcome"] = "pending",
  ): FinanceDealPaymentStepAttempt {
    return {
      attemptNo,
      createdAt: "2026-04-01T00:00:00.000Z",
      id: `00000000-0000-4000-8000-00000000010${attemptNo}`,
      outcome,
      outcomeAt: outcome === "pending" ? null : "2026-04-01T01:00:00.000Z",
      paymentStepId: "00000000-0000-4000-8000-000000000010",
      providerRef: null,
      providerSnapshot: null,
      submittedAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    };
  }

  it("returns null for empty attempts", () => {
    expect(latestStepAttempt(makeStep([]))).toBeNull();
  });

  it("returns the attempt with the highest attemptNo even if out of order", () => {
    const step = makeStep([
      makeAttempt(1, "failed"),
      makeAttempt(3, "pending"),
      makeAttempt(2, "voided"),
    ]);
    expect(latestStepAttempt(step)?.attemptNo).toBe(3);
  });
});
