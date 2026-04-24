import { describe, expect, it } from "vitest";

import {
  computeDealLegState,
  getRequiredDocTypeForLegKind,
  type ComputeDealLegStateInput,
} from "../../src/domain/leg-state-projection";

function makeInput(
  overrides: Partial<ComputeDealLegStateInput> = {},
): ComputeDealLegStateInput {
  return {
    manualOverride: null,
    operationRefs: [],
    latestInstructionStateByOperationId: new Map(),
    requiredDocType: null,
    postedDocTypes: new Set(),
    ...overrides,
  };
}

describe("computeDealLegState", () => {
  describe("manual override wins", () => {
    it("returns `blocked` when override is blocked even if instructions are settled", () => {
      const state = computeDealLegState(
        makeInput({
          manualOverride: "blocked",
          operationRefs: [{ operationId: "op-1" }],
          latestInstructionStateByOperationId: new Map([
            ["op-1", "settled"],
          ]),
          requiredDocType: "invoice",
          postedDocTypes: new Set(["invoice"]),
        }),
      );

      expect(state).toBe("blocked");
    });

    it("returns `skipped` when override is skipped even with zero operations", () => {
      expect(
        computeDealLegState(
          makeInput({
            manualOverride: "skipped",
            operationRefs: [],
          }),
        ),
      ).toBe("skipped");
    });
  });

  describe("no operation refs", () => {
    it("returns `pending` when no operations and no override", () => {
      expect(computeDealLegState(makeInput())).toBe("pending");
    });
  });

  describe("missing instruction state", () => {
    it("returns `pending` when at least one op has no instruction yet", () => {
      const state = computeDealLegState(
        makeInput({
          operationRefs: [
            { operationId: "op-1" },
            { operationId: "op-2" },
          ],
          latestInstructionStateByOperationId: new Map([
            ["op-1", "prepared"],
          ]),
        }),
      );

      expect(state).toBe("pending");
    });
  });

  describe("terminal `done`", () => {
    it("returns `done` when every instruction settled and no doc gate", () => {
      const state = computeDealLegState(
        makeInput({
          operationRefs: [
            { operationId: "op-1" },
            { operationId: "op-2" },
          ],
          latestInstructionStateByOperationId: new Map([
            ["op-1", "settled"],
            ["op-2", "settled"],
          ]),
          requiredDocType: null,
        }),
      );

      expect(state).toBe("done");
    });

    it("returns `done` when every instruction settled and required doc is posted", () => {
      const state = computeDealLegState(
        makeInput({
          operationRefs: [{ operationId: "op-1" }],
          latestInstructionStateByOperationId: new Map([
            ["op-1", "settled"],
          ]),
          requiredDocType: "invoice",
          postedDocTypes: new Set(["invoice"]),
        }),
      );

      expect(state).toBe("done");
    });
  });

  describe("doc gate holds back `done`", () => {
    it("returns `in_progress` when instructions settled but required doc is not posted", () => {
      const state = computeDealLegState(
        makeInput({
          operationRefs: [{ operationId: "op-1" }],
          latestInstructionStateByOperationId: new Map([
            ["op-1", "settled"],
          ]),
          requiredDocType: "invoice",
          postedDocTypes: new Set(),
        }),
      );

      expect(state).toBe("in_progress");
    });
  });

  describe("`in_progress`", () => {
    it("returns `in_progress` when all instructions are submitted or better", () => {
      const state = computeDealLegState(
        makeInput({
          operationRefs: [
            { operationId: "op-1" },
            { operationId: "op-2" },
          ],
          latestInstructionStateByOperationId: new Map([
            ["op-1", "submitted"],
            ["op-2", "settled"],
          ]),
        }),
      );

      expect(state).toBe("in_progress");
    });
  });

  describe("`ready`", () => {
    it("returns `ready` when all instructions are prepared", () => {
      const state = computeDealLegState(
        makeInput({
          operationRefs: [
            { operationId: "op-1" },
            { operationId: "op-2" },
          ],
          latestInstructionStateByOperationId: new Map([
            ["op-1", "prepared"],
            ["op-2", "prepared"],
          ]),
        }),
      );

      expect(state).toBe("ready");
    });
  });

  describe("backward/failed states regress to `pending`", () => {
    it("returns `pending` when any instruction is failed", () => {
      const state = computeDealLegState(
        makeInput({
          operationRefs: [
            { operationId: "op-1" },
            { operationId: "op-2" },
          ],
          latestInstructionStateByOperationId: new Map([
            ["op-1", "prepared"],
            ["op-2", "failed"],
          ]),
        }),
      );

      expect(state).toBe("pending");
    });

    it("returns `pending` when any instruction is voided", () => {
      const state = computeDealLegState(
        makeInput({
          operationRefs: [{ operationId: "op-1" }],
          latestInstructionStateByOperationId: new Map([
            ["op-1", "voided"],
          ]),
        }),
      );

      expect(state).toBe("pending");
    });

    it("returns `pending` when any instruction is returned", () => {
      const state = computeDealLegState(
        makeInput({
          operationRefs: [{ operationId: "op-1" }],
          latestInstructionStateByOperationId: new Map([
            ["op-1", "returned"],
          ]),
        }),
      );

      expect(state).toBe("pending");
    });
  });

  describe("retry regression", () => {
    it("regresses `done` → `in_progress` when a retry prepares a fresh instruction on one op", () => {
      // Leg had all ops settled (+ doc posted) → `done`. Operator retries
      // one op; the *latest* instruction for that op is now `prepared` while
      // the other op's latest is still `settled`.
      const state = computeDealLegState(
        makeInput({
          operationRefs: [
            { operationId: "op-1" },
            { operationId: "op-2" },
          ],
          latestInstructionStateByOperationId: new Map([
            ["op-1", "settled"],
            ["op-2", "prepared"],
          ]),
          requiredDocType: "invoice",
          postedDocTypes: new Set(["invoice"]),
        }),
      );

      expect(state).toBe("ready");
    });
  });
});

describe("getRequiredDocTypeForLegKind", () => {
  it("returns the canonical doc type for a given leg kind", () => {
    expect(
      getRequiredDocTypeForLegKind("collect", {
        collect: "invoice",
        convert: "exchange",
        transit_hold: null,
        payout: null,
        settle_exporter: "transfer_resolution",
      }),
    ).toBe("invoice");
  });

  it("returns null for leg kinds without a required doc", () => {
    expect(
      getRequiredDocTypeForLegKind("transit_hold", {
        collect: "invoice",
        convert: "exchange",
        transit_hold: null,
        payout: null,
        settle_exporter: "transfer_resolution",
      }),
    ).toBeNull();
  });
});
