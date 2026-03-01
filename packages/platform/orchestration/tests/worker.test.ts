import { describe, expect, it, vi } from "vitest";

import { createOrchestrationRetryWorker } from "../src/worker";

describe("createOrchestrationRetryWorker per-item guard", () => {
  it("skips retry scheduling when guard blocks attempt", async () => {
    const connectors = {
      listAttempts: vi.fn(async () => [
        {
          id: "attempt-1",
          intentId: "intent-1",
          attemptNo: 1,
          providerCode: "mock",
          nextRetryAt: null,
        },
      ]),
      getIntentById: vi.fn(async () => ({
        id: "intent-1",
        currentAttemptNo: 1,
        corridor: "default",
        amountMinor: 100n,
        currency: "USD",
        metadata: { bookId: "book-1" },
      })),
      enqueueAttempt: vi.fn(async () => ({})),
    } as any;
    const orchestration = {
      selectNextProviderForIntent: vi.fn(async () => ({
        selected: {
          providerCode: "mock",
          degradationOrder: ["default"],
        },
      })),
      recordAttemptOutcome: vi.fn(async () => ({})),
    } as any;
    const beforeAttempt = vi.fn(async () => false);

    const worker = createOrchestrationRetryWorker({
      connectors,
      orchestration,
      beforeAttempt,
    });
    const processed = await worker.processOnce();

    expect(processed).toBe(0);
    expect(beforeAttempt).toHaveBeenCalledTimes(1);
    expect(orchestration.selectNextProviderForIntent).not.toHaveBeenCalled();
    expect(connectors.enqueueAttempt).not.toHaveBeenCalled();
    expect(orchestration.recordAttemptOutcome).not.toHaveBeenCalled();
  });
});
