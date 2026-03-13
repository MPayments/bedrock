import { describe, expect, it, vi } from "vitest";

import { canonicalJson } from "@bedrock/kernel/canon";
import { sha256Hex } from "@bedrock/kernel/crypto";

import {
  ActionReceiptConflictError,
  ActionReceiptStoredError,
  createIdempotencyService,
} from "../../src";

function createTxStub(options?: {
  insertedReceipt?: Record<string, unknown> | null;
  existingReceipt?: Record<string, unknown> | null;
}) {
  const insertedReceipt = options?.insertedReceipt ?? null;
  const existingReceipt = options?.existingReceipt ?? null;

  return {
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoNothing: vi.fn(() => ({
          returning: vi.fn(async () => (insertedReceipt ? [insertedReceipt] : [])),
        })),
      })),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => (existingReceipt ? [existingReceipt] : [])),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(async () => undefined),
      })),
    })),
  };
}

describe("createIdempotencyService", () => {
  const request = { docType: "transfer", payload: { amount: "100" } };
  const requestHash = sha256Hex(canonicalJson(request));

  it("stores new successful results", async () => {
    const tx = createTxStub({
      insertedReceipt: {
        id: "receipt-1",
        scope: "documents.createDraft",
        idempotencyKey: "idem-1",
        requestHash,
        status: "ok",
        resultJson: null,
        errorJson: null,
        actorId: "user-1",
        createdAt: new Date("2026-02-28T00:00:00.000Z"),
      },
    });
    const service = createIdempotencyService();

    const result = await service.withIdempotencyTx({
      tx: tx as any,
      scope: "documents.createDraft",
      idempotencyKey: "idem-1",
      request,
      actorId: "user-1",
      handler: async () => ({ documentId: "doc-1" }),
      serializeResult: (value) => value,
      loadReplayResult: vi.fn(),
    });

    expect(result).toEqual({ documentId: "doc-1" });
    expect(tx.update).toHaveBeenCalledTimes(1);
  });

  it("replays stored results when the request hash matches", async () => {
    const tx = createTxStub({
      existingReceipt: {
        id: "receipt-1",
        scope: "documents.createDraft",
        idempotencyKey: "idem-1",
        requestHash,
        status: "ok",
        resultJson: { documentId: "doc-1" },
        errorJson: null,
        actorId: "user-1",
        createdAt: new Date("2026-02-28T00:00:00.000Z"),
      },
    });
    const service = createIdempotencyService();
    const loadReplayResult = vi.fn(async ({ storedResult }) => storedResult);

    const result = await service.withIdempotencyTx({
      tx: tx as any,
      scope: "documents.createDraft",
      idempotencyKey: "idem-1",
      request,
      actorId: "user-1",
      handler: vi.fn(),
      serializeResult: (value) => value,
      loadReplayResult,
    });

    expect(result).toEqual({ documentId: "doc-1" });
    expect(loadReplayResult).toHaveBeenCalledTimes(1);
  });

  it("throws conflict when the same key is reused with a different request", async () => {
    const tx = createTxStub({
      existingReceipt: {
        id: "receipt-1",
        scope: "documents.createDraft",
        idempotencyKey: "idem-1",
        requestHash: "different-hash",
        status: "ok",
        resultJson: { documentId: "doc-1" },
        errorJson: null,
        actorId: "user-1",
        createdAt: new Date("2026-02-28T00:00:00.000Z"),
      },
    });
    const service = createIdempotencyService();

    await expect(
      service.withIdempotencyTx({
        tx: tx as any,
        scope: "documents.createDraft",
        idempotencyKey: "idem-1",
        request,
        actorId: "user-1",
        handler: vi.fn(),
        serializeResult: (value) => value,
        loadReplayResult: vi.fn(),
      }),
    ).rejects.toBeInstanceOf(ActionReceiptConflictError);
  });

  it("rethrows stored action failures", async () => {
    const tx = createTxStub({
      existingReceipt: {
        id: "receipt-1",
        scope: "documents.createDraft",
        idempotencyKey: "idem-1",
        requestHash,
        status: "error",
        resultJson: null,
        errorJson: { message: "boom" },
        actorId: "user-1",
        createdAt: new Date("2026-02-28T00:00:00.000Z"),
      },
    });
    const service = createIdempotencyService();

    await expect(
      service.withIdempotencyTx({
        tx: tx as any,
        scope: "documents.createDraft",
        idempotencyKey: "idem-1",
        request,
        actorId: "user-1",
        handler: vi.fn(),
        serializeResult: (value) => value,
        loadReplayResult: vi.fn(),
      }),
    ).rejects.toBeInstanceOf(ActionReceiptStoredError);
  });
});
