import { describe, expect, it } from "vitest";

import { buildTestDocument } from "./helpers";
import { DocumentDraftPlanner } from "../src/documents/domain/document-draft-planner";

describe("DocumentDraftPlanner", () => {
  it("builds create preview documents from draft metadata and summary", () => {
    const planner = new DocumentDraftPlanner();
    const draft = planner.buildCreateDraftMetadata({
      id: "doc-1",
      docType: "invoice",
      docNoPrefix: "INV",
      moduleId: "invoice",
      moduleVersion: 2,
      payloadVersion: 3,
    });

    const preview = planner.buildCreatePreview({
      draft,
      payload: {
        organizationId: "org-1",
        memo: "Desk invoice",
      },
      occurredAt: new Date("2026-03-10T12:00:00.000Z"),
      createIdempotencyKey: "create-1",
      createdBy: "maker-1",
      summary: {
        title: "Invoice",
        memo: "Desk invoice",
        searchText: `${draft.docNo} ${draft.docType} Desk invoice`,
      },
      now: new Date("2026-03-11T12:00:00.000Z"),
      postingRequired: true,
    });

    expect(preview.document).toMatchObject({
      id: "doc-1",
      docNo: "INV-DOC-1",
      docType: "invoice",
      moduleId: "invoice",
      moduleVersion: 2,
      payloadVersion: 3,
      submissionStatus: "draft",
      approvalStatus: "not_required",
      postingStatus: "unposted",
      title: "Invoice",
      memo: "Desk invoice",
      searchText: "inv-doc-1 invoice desk invoice",
    });
    expect(preview.organizationIds).toEqual(["org-1"]);
  });

  it("finalizes create drafts with resolved approval and posting statuses", () => {
    const planner = new DocumentDraftPlanner();
    const draft = planner.buildCreateDraftMetadata({
      id: "doc-2",
      docType: "acceptance",
      docNoPrefix: "ACT",
      moduleId: "acceptance",
      moduleVersion: 1,
      payloadVersion: 1,
    });

    const plan = planner.finalizeCreate({
      draft,
      payload: {
        organizationId: "org-2",
      },
      occurredAt: new Date("2026-03-12T12:00:00.000Z"),
      createIdempotencyKey: "create-2",
      createdBy: "maker-2",
      summary: {
        title: "Acceptance",
        searchText: `${draft.docNo} ${draft.docType} acceptance`,
      },
      now: new Date("2026-03-13T12:00:00.000Z"),
      approvalStatus: "pending",
      postingRequired: false,
    });

    expect(plan.document.approvalStatus).toBe("pending");
    expect(plan.document.postingStatus).toBe("not_required");
    expect(plan.document.createIdempotencyKey).toBe("create-2");
    expect(plan.organizationIds).toEqual(["org-2"]);
  });

  it("builds update preview documents without changing identity metadata", () => {
    const planner = new DocumentDraftPlanner();
    const document = buildTestDocument({
      docType: "exchange",
      docNo: "EXC-1234",
      moduleId: "exchange",
      moduleVersion: 4,
      payloadVersion: 2,
      approvalStatus: "pending",
      payload: {
        organizationId: "org-3",
        memo: "before",
      },
    });

    const preview = planner.buildUpdatePreview({
      document,
      payload: {
        organizationId: "org-3",
        memo: "after",
      },
      occurredAt: new Date("2026-03-14T12:00:00.000Z"),
      summary: {
        title: "Exchange",
        memo: "after",
        searchText: `${document.docNo} ${document.docType} after`,
      },
      now: new Date("2026-03-15T12:00:00.000Z"),
    });

    expect(preview.document.id).toBe(document.id);
    expect(preview.document.docNo).toBe(document.docNo);
    expect(preview.document.moduleId).toBe(document.moduleId);
    expect(preview.document.payloadVersion).toBe(document.payloadVersion);
    expect(preview.document.approvalStatus).toBe("not_required");
    expect(preview.document.searchText).toBe("exc-1234 exchange after");
  });

  it("finalizes updates and returns the resulting accounting-period scope", () => {
    const planner = new DocumentDraftPlanner();
    const document = buildTestDocument({
      payload: {
        organizationId: "org-4",
        organizationIds: ["org-4"],
      },
    });

    const plan = planner.finalizeUpdate({
      document,
      payload: {
        sourceOrganizationId: "org-5",
        destinationOrganizationId: "org-6",
      },
      occurredAt: new Date("2026-03-16T12:00:00.000Z"),
      summary: {
        title: "Updated",
        searchText: `${document.docNo} updated`,
      },
      now: new Date("2026-03-17T12:00:00.000Z"),
      approvalStatus: "pending",
    });

    expect(plan.document.approvalStatus).toBe("pending");
    expect(plan.document.payload).toEqual({
      sourceOrganizationId: "org-5",
      destinationOrganizationId: "org-6",
    });
    expect(plan.organizationIds).toEqual(["org-5", "org-6"]);
  });
});
