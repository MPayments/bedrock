import { describe, expect, it, vi } from "vitest";

import { type Document, type DocumentEvent, type DocumentLink, type DocumentOperation, type DocumentSnapshot } from "@bedrock/db/schema";

import { DocumentNotFoundError } from "../src/errors";
import { createGetDocumentDetailsQuery } from "../src/queries/get-document-details";
import { createGetDocumentQuery } from "../src/queries/get-document";
import { createListDocumentsQuery } from "../src/queries/list-documents";
import type { DocumentModule } from "../src/types";

function makeDocument(overrides: Partial<Document> = {}): Document {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    docType: "test_document",
    docNo: "TST-11111111",
    moduleId: "test_document",
    moduleVersion: 1,
    payloadVersion: 1,
    payload: { memo: "hello" },
    title: "Test document",
    occurredAt: new Date("2026-03-01T10:00:00.000Z"),
    submissionStatus: "draft",
    approvalStatus: "not_required",
    postingStatus: "unposted",
    lifecycleStatus: "active",
    createIdempotencyKey: "idem-1",
    amountMinor: null,
    currency: null,
    memo: null,
    counterpartyId: null,
    customerId: null,
    operationalAccountId: null,
    searchText: "test",
    createdBy: "maker-1",
    submittedBy: null,
    submittedAt: null,
    approvedBy: null,
    approvedAt: null,
    rejectedBy: null,
    rejectedAt: null,
    cancelledBy: null,
    cancelledAt: null,
    postingStartedAt: null,
    postedAt: null,
    postingError: null,
    createdAt: new Date("2026-03-01T10:00:00.000Z"),
    updatedAt: new Date("2026-03-01T10:00:00.000Z"),
    version: 1,
    ...overrides,
  };
}

function createModuleStub(): DocumentModule {
  return {
    docType: "test_document",
    docNoPrefix: "TST",
    payloadVersion: 1,
    createSchema: {} as any,
    updateSchema: {} as any,
    payloadSchema: {} as any,
    postingRequired: true,
    approvalRequired: () => false,
    async createDraft() {
      throw new Error("not implemented");
    },
    async updateDraft() {
      throw new Error("not implemented");
    },
    deriveSummary() {
      return {
        title: "Test",
        searchText: "test",
      };
    },
    async canCreate() {},
    async canEdit() {},
    async canSubmit() {},
    async canApprove() {},
    async canReject() {},
    async canPost() {},
    async canCancel() {},
    async buildDetails() {
      return {
        computed: { label: "computed" },
        extra: { source: "module" },
      };
    },
    buildPostIdempotencyKey() {
      return "post-idem";
    },
  };
}

describe("documents queries", () => {
  it("loads a single document with its posting operation id", async () => {
    const document = makeDocument();
    const db = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          leftJoin: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => [
                {
                  document,
                  postingOperationId: "op-1",
                },
              ]),
            })),
          })),
        })),
      })),
    };

    const getDocument = createGetDocumentQuery({ db } as any);

    await expect(
      getDocument(document.docType, document.id),
    ).resolves.toEqual({
      document,
      postingOperationId: "op-1",
    });
  });

  it("raises not found for missing document queries", async () => {
    const db = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          leftJoin: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => []),
            })),
          })),
        })),
      })),
    };

    const getDocument = createGetDocumentQuery({ db } as any);
    await expect(getDocument("test_document", "missing")).rejects.toThrow(
      DocumentNotFoundError,
    );
  });

  it("lists documents with the current pagination mapping", async () => {
    const document = makeDocument();
    const rows = [
      {
        document,
        postingOperationId: null,
      },
    ];

    const db = {
      select: vi
        .fn()
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            leftJoin: vi.fn(() => ({
              where: vi.fn(() => ({
                orderBy: vi.fn(() => ({
                  limit: vi.fn(() => ({
                    offset: vi.fn(async () => rows),
                  })),
                })),
              })),
            })),
          })),
        })
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(async () => [{ value: 1 }]),
          })),
        }),
    };

    const listDocuments = createListDocumentsQuery({ db } as any);
    const result = await listDocuments({
      query: "test",
      limit: 5,
      offset: 10,
      sortBy: "createdAt",
      sortOrder: "asc",
    });

    expect(result).toEqual({
      data: [{ document, postingOperationId: null }],
      total: 1,
      limit: 5,
      offset: 10,
    });
  });

  it("loads document details, related documents, snapshots, and ledger operations", async () => {
    const document = makeDocument();
    const parent = makeDocument({
      id: "22222222-2222-4222-8222-222222222222",
      docNo: "TST-22222222",
    });
    const child = makeDocument({
      id: "33333333-3333-4333-8333-333333333333",
      docNo: "TST-33333333",
    });
    const dependsOn = makeDocument({
      id: "44444444-4444-4444-8444-444444444444",
      docNo: "TST-44444444",
    });
    const compensates = makeDocument({
      id: "55555555-5555-4555-8555-555555555555",
      docNo: "TST-55555555",
    });
    const links: DocumentLink[] = [
      {
        fromDocumentId: document.id,
        toDocumentId: parent.id,
        linkType: "parent",
        role: null,
        createdAt: new Date("2026-03-01T10:00:00.000Z"),
      },
      {
        fromDocumentId: document.id,
        toDocumentId: dependsOn.id,
        linkType: "depends_on",
        role: null,
        createdAt: new Date("2026-03-01T10:00:00.000Z"),
      },
      {
        fromDocumentId: document.id,
        toDocumentId: compensates.id,
        linkType: "compensates",
        role: null,
        createdAt: new Date("2026-03-01T10:00:00.000Z"),
      },
      {
        fromDocumentId: child.id,
        toDocumentId: document.id,
        linkType: "parent",
        role: null,
        createdAt: new Date("2026-03-01T10:00:00.000Z"),
      },
    ];
    const documentOperations: DocumentOperation[] = [
      {
        documentId: document.id,
        operationId: "op-1",
        kind: "post",
        createdAt: new Date("2026-03-01T10:00:00.000Z"),
      },
    ];
    const events: DocumentEvent[] = [
      {
        id: "evt-1",
        documentId: document.id,
        eventType: "create",
        actorId: "maker-1",
        requestId: null,
        correlationId: null,
        traceId: null,
        causationId: null,
        reasonCode: null,
        reasonMeta: null,
        before: null,
        after: null,
        createdAt: new Date("2026-03-01T10:00:00.000Z"),
      },
    ];
    const snapshot: DocumentSnapshot = {
      id: "snap-1",
      documentId: document.id,
      payload: document.payload,
      payloadVersion: document.payloadVersion,
      moduleId: document.moduleId,
      moduleVersion: document.moduleVersion,
      packChecksum: "pack-1",
      postingPlanChecksum: "plan-1",
      journalIntentChecksum: "intent-1",
      postingPlan: {},
      journalIntent: {},
      resolvedTemplates: null,
      createdAt: new Date("2026-03-01T10:00:00.000Z"),
    };
    const db = {
      select: vi
        .fn()
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => [document]),
            })),
          })),
        })
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(async () => links),
          })),
        })
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(async () => [parent, child, dependsOn, compensates]),
          })),
        })
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(async () => documentOperations),
          })),
        })
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(async () => events),
          })),
        })
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => [snapshot]),
            })),
          })),
        }),
    };
    const ledgerReadService = {
      getOperationDetails: vi.fn(async (operationId: string) => ({
        id: operationId,
        status: "posted",
      })),
    };
    const registry = {
      getDocumentModule: vi.fn(() => createModuleStub()),
    };

    const getDetails = createGetDocumentDetailsQuery({
      db,
      ledgerReadService,
      log: {} as any,
      registry,
    } as any);

    const result = await getDetails(document.docType, document.id, "checker-1");

    expect(result.parent?.id).toBe(parent.id);
    expect(result.children.map((item) => item.id)).toEqual([child.id]);
    expect(result.dependsOn.map((item) => item.id)).toEqual([dependsOn.id]);
    expect(result.compensates.map((item) => item.id)).toEqual([compensates.id]);
    expect(result.postingOperationId).toBe("op-1");
    expect(result.events).toEqual(events);
    expect(result.snapshot).toEqual(snapshot);
    expect(result.ledgerOperations).toEqual([{ id: "op-1", status: "posted" }]);
    expect(result.computed).toEqual({ label: "computed" });
    expect(result.extra).toEqual({ source: "module" });
  });
});
