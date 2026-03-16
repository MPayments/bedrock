import { describe, expect, it, vi } from "vitest";

import { createReconciliationAdjustmentsWorkflow } from "../src";

describe("reconciliation adjustments workflow", () => {
  it("creates an adjustment draft and resolves the exception atomically", async () => {
    const tx = { id: "tx-1" };
    const db = {
      transaction: vi.fn(async (run: (value: any) => Promise<unknown>) => run(tx)),
    };
    const createDraft = vi.fn(async () => ({
      document: {
        id: "doc-1",
      },
      postingOperationId: null,
      allowedActions: [],
    }));
    const resolveWithAdjustment = vi.fn(async () => ({
      exceptionId: "11111111-1111-4111-8111-111111111111",
      documentId: "doc-1",
      alreadyResolved: false,
    }));
    const workflow = createReconciliationAdjustmentsWorkflow({
      db: db as any,
      idempotency: {
        withIdempotencyTx: vi.fn(async ({ handler }) => handler()),
      } as any,
      createDocumentsService: () => ({
        createDraft: createDraft as any,
      }),
      createReconciliationService: () => ({
        exceptions: {
          getAdjustmentResolution: vi.fn(async () => ({
            exceptionId: "11111111-1111-4111-8111-111111111111",
            documentId: "",
            alreadyResolved: false,
          })),
          resolveWithAdjustment,
        },
      }),
    });

    const result = await workflow.createAdjustmentDocument({
      exceptionId: "11111111-1111-4111-8111-111111111111",
      docType: "transfer_intra",
      payload: { amountMinor: "1000" },
      actorUserId: "user-1",
      idempotencyKey: "recon-adjustment-1",
    });

    expect(createDraft).toHaveBeenCalledTimes(1);
    expect(resolveWithAdjustment).toHaveBeenCalledWith({
      exceptionId: "11111111-1111-4111-8111-111111111111",
      adjustmentDocumentId: "doc-1",
    });
    expect(result).toEqual({
      exceptionId: "11111111-1111-4111-8111-111111111111",
      documentId: "doc-1",
    });
  });
});
