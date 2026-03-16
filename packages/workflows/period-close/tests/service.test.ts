import { describe, expect, it, vi } from "vitest";

import { createPeriodCloseWorkflow } from "../src";

describe("createPeriodCloseWorkflow", () => {
  it("skips creation when a matching period-close document already exists", async () => {
    const workflow = createPeriodCloseWorkflow({
      documents: {
        findDocumentIdByCreateIdempotencyKey: vi
          .fn()
          .mockResolvedValue("doc_existing"),
        createDraft: vi.fn(),
        submit: vi.fn(),
      },
    });

    const created = await workflow.createPeriodCloseForOrganization({
      actorUserId: "user_1",
      organizationId: "org_1",
      periodStart: new Date("2026-02-01T00:00:00.000Z"),
      periodEnd: new Date("2026-02-28T23:59:59.000Z"),
      periodLabel: "2026-02",
    });

    expect(created).toBe(false);
  });

  it("creates and submits a period-close draft when none exists", async () => {
    const createDraft = vi.fn().mockResolvedValue({
      document: {
        id: "doc_1",
        docType: "period_close",
        submissionStatus: "draft",
      },
    });
    const submit = vi.fn().mockResolvedValue(undefined);
    const workflow = createPeriodCloseWorkflow({
      documents: {
        findDocumentIdByCreateIdempotencyKey: vi.fn().mockResolvedValue(null),
        createDraft,
        submit,
      },
    });

    const created = await workflow.createPeriodCloseForOrganization({
      actorUserId: "user_1",
      organizationId: "org_1",
      periodStart: new Date("2026-02-01T00:00:00.000Z"),
      periodEnd: new Date("2026-02-28T23:59:59.000Z"),
      periodLabel: "2026-02",
    });

    expect(created).toBe(true);
    expect(createDraft).toHaveBeenCalledWith({
      docType: "period_close",
      createIdempotencyKey: "period_close:org_1:2026-02",
      actorUserId: "user_1",
      payload: {
        organizationId: "org_1",
        periodStart: "2026-02-01T00:00:00.000Z",
        periodEnd: "2026-02-28T23:59:59.000Z",
        occurredAt: "2026-02-28T23:59:59.000Z",
        closeReason: "auto_monthly_close",
      },
    });
    expect(submit).toHaveBeenCalledWith({
      docType: "period_close",
      documentId: "doc_1",
      actorUserId: "user_1",
      idempotencyKey: "period_close:org_1:2026-02:submit",
    });
  });
});
