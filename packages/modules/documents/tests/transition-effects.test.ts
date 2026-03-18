import { describe, expect, it, vi } from "vitest";

import { createAccountingPeriodDocumentTransitionEffectsService } from "../src";

describe("createAccountingPeriodDocumentTransitionEffectsService", () => {
  it("does not mutate accounting periods on submit when approval is still pending", async () => {
    const closePeriod = vi.fn();
    const service = createAccountingPeriodDocumentTransitionEffectsService();

    await service.apply({
      action: "submit",
      before: {
        id: "doc-1",
        docType: "period_close",
        approvalStatus: "pending",
      } as any,
      after: {
        id: "doc-1",
        docType: "period_close",
        occurredAt: new Date("2026-03-31T00:00:00.000Z"),
        approvalStatus: "pending",
        payload: {
          organizationId: "org-1",
          periodStart: "2026-03-01T00:00:00.000Z",
          periodEnd: "2026-03-31T00:00:00.000Z",
        },
      } as any,
      module: {} as any,
      moduleContext: {} as any,
      services: {
        accountingPeriods: {
          closePeriod,
          reopenPeriod: vi.fn(),
        },
      } as any,
      transition: {
        action: "submit",
        docType: "period_close",
        documentId: "doc-1",
        actorUserId: "approver-1",
      },
    });

    expect(closePeriod).not.toHaveBeenCalled();
  });

  it("mutates accounting periods on approve for period-close documents", async () => {
    const closePeriod = vi.fn();
    const service = createAccountingPeriodDocumentTransitionEffectsService();

    await service.apply({
      action: "approve",
      before: {
        id: "doc-1",
        docType: "period_close",
        approvalStatus: "pending",
      } as any,
      after: {
        id: "doc-1",
        docType: "period_close",
        occurredAt: new Date("2026-03-31T00:00:00.000Z"),
        approvalStatus: "approved",
        payload: {
          organizationId: "org-1",
          periodStart: "2026-03-01T00:00:00.000Z",
          periodEnd: "2026-03-31T00:00:00.000Z",
          closeReason: "manual",
        },
      } as any,
      module: {} as any,
      moduleContext: {} as any,
      services: {
        accountingPeriods: {
          closePeriod,
          reopenPeriod: vi.fn(),
        },
      } as any,
      transition: {
        action: "approve",
        docType: "period_close",
        documentId: "doc-1",
        actorUserId: "approver-1",
      },
      transaction: { id: "tx-1" },
    });

    expect(closePeriod).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        closeDocumentId: "doc-1",
        db: { id: "tx-1" },
      }),
    );
  });
});
