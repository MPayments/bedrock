import { describe, expect, it, vi } from "vitest";

import { createDocumentPostingWorkflow } from "../src";

describe("document posting workflow", () => {
  it("commits prepared post intents and finalizes through the documents seam", async () => {
    const tx = { id: "tx-1" };
    const db = {
      transaction: vi.fn(async (run: (value: any) => Promise<unknown>) => run(tx)),
    };
    const preparePost = vi.fn(async () => ({
      resolved: { intent: { id: "intent-1" } },
      document: { id: "doc-1" },
      successEvents: [],
      finalEvent: {
        eventType: "post",
        before: null,
        after: null,
      },
      actorUserId: "user-1",
      docType: "test_document",
      action: "post" as const,
      postingOperationId: null,
    }));
    const finalizeSuccess = vi.fn(async () => ({
      document: { id: "doc-1" },
      postingOperationId: "op-1",
      allowedActions: [],
    }));
    const commit = vi.fn(async () => ({
      operationId: "op-1",
      pendingTransferIdsByRef: {},
    }));
    const createLedgerModule = vi.fn(() => ({
      operations: {
        commands: {
          commit,
        },
      },
    }));
    const get = vi.fn();
    const workflow = createDocumentPostingWorkflow({
      db: db as any,
      idempotency: {
        withIdempotencyTx: vi.fn(async ({ handler }) => handler()),
      } as any,
      createLedgerModule: createLedgerModule as any,
      createDocumentsService: () => ({
        get,
        actions: {
          execute: vi.fn(),
          resolveIdempotencyKey: vi.fn(async () => "idem-post"),
          prepare: preparePost as any,
          finalizeSuccess: finalizeSuccess as any,
          finalizeFailure: vi.fn(),
        },
      }),
    });

    const result = await workflow.post({
      docType: "test_document",
      documentId: "doc-1",
      actorUserId: "user-1",
    });

    expect(createLedgerModule).toHaveBeenCalledWith(tx);
    expect(commit).toHaveBeenCalledWith({ id: "intent-1" });
    expect(preparePost).toHaveBeenCalledWith({
      action: "post",
      docType: "test_document",
      documentId: "doc-1",
      actorUserId: "user-1",
    });
    expect(result.postingOperationId).toBe("op-1");
    expect(finalizeSuccess).toHaveBeenCalledWith({
      prepared: expect.objectContaining({
        document: { id: "doc-1" },
      }),
      operationId: "op-1",
    });
  });

  it("finalizes reposts without issuing a new ledger commit", async () => {
    const tx = { id: "tx-1" };
    const db = {
      transaction: vi.fn(async (run: (value: any) => Promise<unknown>) => run(tx)),
    };
    const finalizeSuccess = vi.fn(async () => ({
      document: { id: "doc-1" },
      postingOperationId: "op-existing",
      allowedActions: [],
    }));
    const commit = vi.fn();
    const createLedgerModule = vi.fn(() => ({
      operations: {
        commands: {
          commit,
        },
      },
    }));
    const workflow = createDocumentPostingWorkflow({
      db: db as any,
      idempotency: {
        withIdempotencyTx: vi.fn(async ({ handler }) => handler()),
      } as any,
      createLedgerModule: createLedgerModule as any,
      createDocumentsService: () => ({
        get: vi.fn(),
        actions: {
          execute: vi.fn(),
          resolveIdempotencyKey: vi.fn(async () => "idem-repost"),
          prepare: vi.fn(async () => ({
            document: { id: "doc-1" },
            successEvents: [],
            finalEvent: {
              eventType: "repost",
              before: null,
              after: null,
            },
            actorUserId: "user-1",
            docType: "test_document",
            action: "repost" as const,
            postingOperationId: "op-existing",
          })) as any,
          finalizeSuccess: finalizeSuccess as any,
          finalizeFailure: vi.fn(),
        },
      }),
    });

    const result = await workflow.repost({
      docType: "test_document",
      documentId: "doc-1",
      actorUserId: "user-1",
    });

    expect(result.postingOperationId).toBe("op-existing");
    expect(commit).not.toHaveBeenCalled();
  });
});
