import { describe, expect, it, vi } from "vitest";

import { createAttemptDispatchWorkerDefinition } from "../../../src/connectors/workers/attempt-dispatch";
import { createStatementIngestWorkerDefinition } from "../../../src/connectors/workers/statement-ingest";
import { createStatusPollerWorkerDefinition } from "../../../src/connectors/workers/status-poller";

async function runWorkerOnce(
  worker:
    | ReturnType<typeof createAttemptDispatchWorkerDefinition>
    | ReturnType<typeof createStatusPollerWorkerDefinition>
    | ReturnType<typeof createStatementIngestWorkerDefinition>,
) {
  const result = await worker.runOnce({
    now: new Date("2026-03-01T00:00:00Z"),
    signal: new AbortController().signal,
  });
  return result.processed;
}

describe("connectors workers per-item guard", () => {
  it("requeues dispatch item when guard blocks attempt", async () => {
    const initiate = vi.fn(async () => ({ status: "submitted" as const }));
    const connectors = {
      claimDispatchBatch: vi.fn(async () => [
        {
          attempt: {
            id: "attempt-1",
            intentId: "intent-1",
            attemptNo: 1,
            providerCode: "mock",
            providerRoute: "default",
            status: "dispatching",
            idempotencyKey: "idem-1",
            requestPayload: {},
            updatedAt: new Date("2026-03-01T00:00:00Z"),
          },
          intent: {
            id: "intent-1",
            documentId: "doc-1",
            docType: "payment",
            direction: "payin",
            amountMinor: 100n,
            currency: "USD",
            corridor: "default",
            metadata: { bookId: "book-1" },
          },
        },
      ]),
      recordAttemptStatus: vi.fn(async () => ({})),
      upsertProviderHealth: vi.fn(async () => ({})),
      providers: {
        mock: {
          initiate,
        },
      },
    } as any;

    const beforeAttempt = vi.fn(async () => false);
    const worker = createAttemptDispatchWorkerDefinition({ connectors, beforeAttempt });
    const processed = await runWorkerOnce(worker);

    expect(processed).toBe(0);
    expect(beforeAttempt).toHaveBeenCalledTimes(1);
    expect(initiate).not.toHaveBeenCalled();
    expect(connectors.recordAttemptStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        attemptId: "attempt-1",
        status: "queued",
      }),
    );
  });

  it("skips status polling item when guard blocks attempt", async () => {
    const getStatus = vi.fn(async () => ({ status: "pending" as const }));
    const connectors = {
      claimPollBatch: vi.fn(async () => [
        {
          attempt: {
            id: "attempt-2",
            intentId: "intent-2",
            attemptNo: 2,
            providerCode: "mock",
            status: "pending",
            externalAttemptRef: "ext-2",
            updatedAt: new Date("2026-03-01T00:00:00Z"),
          },
          intent: {
            id: "intent-2",
            metadata: { bookId: "book-2" },
          },
        },
      ]),
      recordAttemptStatus: vi.fn(async () => ({})),
      upsertProviderHealth: vi.fn(async () => ({})),
      providers: {
        mock: {
          getStatus,
        },
      },
    } as any;

    const beforeAttempt = vi.fn(async () => false);
    const worker = createStatusPollerWorkerDefinition({ connectors, beforeAttempt });
    const processed = await runWorkerOnce(worker);

    expect(processed).toBe(0);
    expect(beforeAttempt).toHaveBeenCalledTimes(1);
    expect(getStatus).not.toHaveBeenCalled();
    expect(connectors.recordAttemptStatus).not.toHaveBeenCalled();
  });

  it("skips statement cursor when guard blocks cursor", async () => {
    const fetchStatements = vi.fn(async () => ({
      records: [],
      nextCursor: null,
    }));
    const connectors = {
      claimStatementProviders: vi.fn(async () => [
        {
          providerCode: "mock",
          cursorKey: "default",
          cursorValue: null,
        },
      ]),
      ingestStatementBatch: vi.fn(async () => ({ inserted: 0 })),
      providers: {
        mock: {
          fetchStatements,
        },
      },
    } as any;

    const beforeCursor = vi.fn(async () => false);
    const worker = createStatementIngestWorkerDefinition({ connectors, beforeCursor });
    const processed = await runWorkerOnce(worker);

    expect(processed).toBe(0);
    expect(beforeCursor).toHaveBeenCalledTimes(1);
    expect(fetchStatements).not.toHaveBeenCalled();
    expect(connectors.ingestStatementBatch).not.toHaveBeenCalled();
  });

  it("returns zero in manual provider mode when guard blocks cursor", async () => {
    const connectors = {
      claimStatementProviders: vi.fn(async () => []),
      ingestStatementBatch: vi.fn(async () => ({ inserted: 5 })),
      providers: {
        mock: {
          fetchStatements: vi.fn(async () => ({
            records: [],
            nextCursor: null,
          })),
        },
      },
    } as any;
    const beforeCursor = vi.fn(async () => false);
    const worker = createStatementIngestWorkerDefinition({ connectors, beforeCursor });

    const result = await worker.processProviderOnce({
      providerCode: "mock",
      range: {
        from: new Date("2026-03-01T00:00:00Z"),
        to: new Date("2026-03-01T01:00:00Z"),
      },
    });

    expect(result).toEqual({ inserted: 0 });
    expect(connectors.providers.mock.fetchStatements).not.toHaveBeenCalled();
    expect(connectors.ingestStatementBatch).not.toHaveBeenCalled();
  });
});
