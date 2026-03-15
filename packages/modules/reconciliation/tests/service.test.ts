import { describe, expect, it, vi } from "vitest";

import { createReconciliationService } from "../src/reconciliation";

const EXCEPTION_ID = "11111111-1111-4111-8111-111111111111";

function createExceptionRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: EXCEPTION_ID,
    runId: "22222222-2222-4222-8222-222222222222",
    externalRecordId: "33333333-3333-4333-8333-333333333333",
    matchedOperationId: null,
    matchedDocumentId: null,
    reasonCode: "no_match",
    reasonMeta: null,
    state: "open",
    adjustmentDocumentId: null,
    createdAt: new Date("2026-03-01T00:00:00.000Z"),
    resolvedAt: null,
    ...overrides,
  };
}

function createServiceContext(exceptionRow = createExceptionRow()) {
  const selectForUpdate = vi.fn(async () => [exceptionRow]);
  const selectLimit = vi.fn(() => ({
    for: selectForUpdate,
  }));
  const updateWhere = vi.fn(async () => undefined);
  const updateSet = vi.fn(() => ({
    where: updateWhere,
  }));
  const tx = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: selectLimit,
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: updateSet,
    })),
  };
  const db = {
    transaction: vi.fn(async (callback: (value: typeof tx) => Promise<unknown>) =>
      callback(tx),
    ),
  };
  const documents = {
    createDraft: vi.fn(async () => ({
      document: {
        id: "doc-1",
      },
    })),
    existsById: vi.fn(async () => false),
  };
  const idempotency = {
    withIdempotencyTx: vi.fn(async ({ handler }: { handler: () => Promise<unknown> }) =>
      handler(),
    ),
  };
  const ledgerLookup = {
    operationExists: vi.fn(async () => false),
  };

  return {
    service: createReconciliationService({
      db: db as any,
      documents,
      idempotency: idempotency as any,
      ledgerLookup,
    }),
    db,
    documents,
    idempotency,
    ledgerLookup,
    tx,
    updateSet,
  };
}

describe("reconciliation service", () => {
  it("creates adjustment documents through the documents port and resolves the exception", async () => {
    const { service, documents, idempotency, updateSet } = createServiceContext();

    const result = await service.createAdjustmentDocument({
      exceptionId: EXCEPTION_ID,
      docType: "transfer_intra",
      payload: { amountMinor: "1000", currency: "USD" },
      actorUserId: "user-1",
      idempotencyKey: "recon-adjustment-1",
      requestContext: {
        requestId: "req-1",
        correlationId: "corr-1",
      },
    });

    expect(idempotency.withIdempotencyTx).toHaveBeenCalledTimes(1);
    expect(documents.createDraft).toHaveBeenCalledWith({
      docType: "transfer_intra",
      createIdempotencyKey: expect.any(String),
      payload: { amountMinor: "1000", currency: "USD" },
      actorUserId: "user-1",
      requestContext: {
        requestId: "req-1",
        correlationId: "corr-1",
      },
    });
    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        state: "resolved",
        adjustmentDocumentId: "doc-1",
        resolvedAt: expect.any(Date),
      }),
    );
    expect(result).toEqual({
      exceptionId: EXCEPTION_ID,
      documentId: "doc-1",
    });
  });

  it("reuses an existing adjustment document without calling the documents port", async () => {
    const { service, documents, updateSet } = createServiceContext(
      createExceptionRow({
        adjustmentDocumentId: "doc-existing",
      }),
    );

    await expect(
      service.createAdjustmentDocument({
        exceptionId: EXCEPTION_ID,
        docType: "transfer_intra",
        payload: { amountMinor: "1000" },
        actorUserId: "user-1",
        idempotencyKey: "recon-adjustment-1",
      }),
    ).resolves.toEqual({
      exceptionId: EXCEPTION_ID,
      documentId: "doc-existing",
    });

    expect(documents.createDraft).not.toHaveBeenCalled();
    expect(updateSet).not.toHaveBeenCalled();
  });
});
