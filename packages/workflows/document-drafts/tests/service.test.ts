import { describe, expect, it, vi } from "vitest";

import { createDocumentDraftWorkflow } from "../src";

describe("document draft workflow", () => {
  it("creates drafts through the transactional documents seam only", async () => {
    const tx = { id: "tx-1" };
    const db = {
      transaction: vi.fn(async (run: (value: any) => Promise<unknown>) => run(tx)),
    };
    const createDraft = vi.fn(async () => ({
      document: {
        id: "doc-1",
        docType: "period_close",
        occurredAt: new Date("2026-03-31T00:00:00.000Z"),
        payload: {
          organizationId: "org-1",
          periodStart: "2026-03-01T00:00:00.000Z",
          periodEnd: "2026-03-31T00:00:00.000Z",
          closeReason: "auto",
        },
      },
      postingOperationId: null,
      allowedActions: [],
    }));
    const workflow = createDocumentDraftWorkflow({
      db: db as any,
      createDocumentsService: () => ({
        createDraft: createDraft as any,
      }),
    });

    await workflow.createDraft({
      docType: "period_close",
      actorUserId: "user-1",
      payload: {},
    } as any);

    expect(createDraft).toHaveBeenCalledTimes(1);
    expect(db.transaction).toHaveBeenCalledTimes(1);
  });
});
