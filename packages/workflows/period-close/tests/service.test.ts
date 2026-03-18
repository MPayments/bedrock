import { describe, expect, it, vi } from "vitest";

import { createPeriodCloseWorkflow } from "../src";

describe("createPeriodCloseWorkflow", () => {
  it("skips creation when an active period-close document is already pending approval", async () => {
    const workflow = createPeriodCloseWorkflow({
      documents: {
        listPeriodCloseDocuments: vi.fn().mockResolvedValue([
          {
            id: "doc_existing",
            docType: "period_close",
            createIdempotencyKey: "period_close:org_1:2026-02",
            submissionStatus: "submitted",
            approvalStatus: "pending",
            lifecycleStatus: "active",
          },
        ]),
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
        listPeriodCloseDocuments: vi.fn().mockResolvedValue([]),
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

  it("submits an existing active draft instead of creating a new period-close attempt", async () => {
    const createDraft = vi.fn();
    const submit = vi.fn().mockResolvedValue(undefined);
    const workflow = createPeriodCloseWorkflow({
      documents: {
        listPeriodCloseDocuments: vi.fn().mockResolvedValue([
          {
            id: "doc_1",
            docType: "period_close",
            createIdempotencyKey: "period_close:org_1:2026-02",
            submissionStatus: "draft",
            approvalStatus: "pending",
            lifecycleStatus: "active",
          },
        ]),
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
    expect(createDraft).not.toHaveBeenCalled();
    expect(submit).toHaveBeenCalledWith({
      docType: "period_close",
      documentId: "doc_1",
      actorUserId: "user_1",
      idempotencyKey: "period_close:org_1:2026-02:submit",
    });
  });

  it.each([
    {
      name: "rejected",
      document: {
        id: "doc_1",
        docType: "period_close",
        createIdempotencyKey: "period_close:org_1:2026-02",
        submissionStatus: "submitted",
        approvalStatus: "rejected",
        lifecycleStatus: "active",
      },
    },
    {
      name: "cancelled",
      document: {
        id: "doc_1",
        docType: "period_close",
        createIdempotencyKey: "period_close:org_1:2026-02",
        submissionStatus: "submitted",
        approvalStatus: "pending",
        lifecycleStatus: "cancelled",
      },
    },
  ])(
    "creates a retry attempt when the latest period-close document is $name",
    async ({ document }) => {
      const createDraft = vi.fn().mockResolvedValue({
        document: {
          id: "doc_2",
          docType: "period_close",
          submissionStatus: "draft",
        },
      });
      const submit = vi.fn().mockResolvedValue(undefined);
      const workflow = createPeriodCloseWorkflow({
        documents: {
          listPeriodCloseDocuments: vi.fn().mockResolvedValue([document]),
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
        createIdempotencyKey: "period_close:org_1:2026-02:retry:2",
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
        documentId: "doc_2",
        actorUserId: "user_1",
        idempotencyKey: "period_close:org_1:2026-02:retry:2:submit",
      });
    },
  );
});
