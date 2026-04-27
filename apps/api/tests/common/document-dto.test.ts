import { describe, expect, it } from "vitest";

import {
  toDocumentDetailsDto,
  toDocumentDto,
} from "../../src/routes/internal/document-dto";

function createDocumentWithOperation() {
  const now = new Date("2026-01-01T00:00:00.000Z");

  return {
    allowedActions: ["edit"],
    dealId: null,
    document: {
      approvalStatus: "not_required",
      approvedAt: null,
      approvedBy: null,
      cancelledAt: null,
      cancelledBy: null,
      counterpartyId: "11111111-1111-4111-8111-111111111112",
      createIdempotencyKey: "create-idem",
      createdAt: now,
      createdBy: "user-1",
      currency: "RUB",
      customerId: "11111111-1111-4111-8111-111111111113",
      docNo: "INV-1",
      docType: "invoice",
      id: "11111111-1111-4111-8111-111111111111",
      lifecycleStatus: "active",
      memo: null,
      moduleId: "documents.commercial",
      moduleVersion: "1.0.0",
      occurredAt: now,
      organizationRequisiteId: "11111111-1111-4111-8111-111111111114",
      payload: {
        amount: "2576850.98",
        amountMinor: "257685098",
        counterpartyId: "11111111-1111-4111-8111-111111111112",
        currency: "RUB",
        customerId: "11111111-1111-4111-8111-111111111113",
        financialLines: [],
        memo: null,
        occurredAt: now.toISOString(),
        organizationId: "11111111-1111-4111-8111-111111111115",
        organizationRequisiteId: "11111111-1111-4111-8111-111111111114",
      },
      payloadVersion: 1,
      postedAt: null,
      postingError: null,
      postingStartedAt: null,
      postingStatus: "unposted",
      rejectedAt: null,
      rejectedBy: null,
      searchText: "",
      submissionStatus: "draft",
      submittedAt: null,
      submittedBy: null,
      title: "Счёт на оплату",
      updatedAt: now,
      version: 1,
      amountMinor: 257685098n,
    },
    postingOperationId: null,
  } as const;
}

describe("document dto serialization", () => {
  it("keeps raw persisted payload for document dto", () => {
    const dto = toDocumentDto(createDocumentWithOperation());

    expect(dto.payload).toMatchObject({
      amount: "2576850.98",
      amountMinor: "257685098",
      currency: "RUB",
    });
  });

  it("keeps raw document and snapshot payloads in details dto", () => {
    const base = createDocumentWithOperation();
    const details = toDocumentDetailsDto({
      allowedActions: base.allowedActions,
      children: [],
      compensates: [],
      computed: null,
      dealId: base.dealId,
      dependsOn: [],
      document: base.document,
      documentOperations: [],
      events: [],
      extra: null,
      ledgerOperations: [],
      links: [],
      parent: null,
      postingOperationId: base.postingOperationId,
      snapshot: {
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        documentId: base.document.id,
        id: "22222222-2222-4222-8222-222222222222",
        journalIntent: null,
        journalIntentChecksum: null,
        moduleId: base.document.moduleId,
        moduleVersion: base.document.moduleVersion,
        packChecksum: null,
        payload: base.document.payload,
        payloadVersion: base.document.payloadVersion,
        postingPlan: null,
        postingPlanChecksum: null,
        resolvedTemplates: null,
      },
    });

    expect(
      (details as { document: { payload: Record<string, unknown> } }).document.payload,
    ).toMatchObject({
      amountMinor: "257685098",
      currency: "RUB",
    });
    expect(
      (
        details as {
          snapshot: { payload: Record<string, unknown> } | null;
        }
      ).snapshot?.payload,
    ).toMatchObject({
      amountMinor: "257685098",
      currency: "RUB",
    });
  });
});
