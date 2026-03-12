import { describe, expect, it, vi } from "vitest";

import { type Document, type DocumentEvent, type DocumentLink, type DocumentOperation, type DocumentSnapshot } from "@bedrock/documents/schema";

import { DocumentNotFoundError } from "../../src/documents/errors";
import { createGetDocumentQuery } from "../../src/documents/queries/get-document";
import { createGetDocumentDetailsQuery } from "../../src/documents/queries/get-document-details";
import { createListDocumentsQuery } from "../../src/documents/queries/list-documents";
import type { DocumentModule } from "../../src/documents/types";
import {
  buildTestDocument,
  createTestDocumentModule,
} from "../support/builders/documents";

const makeDocument = (overrides: Partial<Document> = {}) => buildTestDocument(overrides);
const createModuleStub = () =>
  createTestDocumentModule() as DocumentModule;

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
      allowedActions: [],
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
      data: [{ document, postingOperationId: null, allowedActions: [] }],
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
        id: "link-1",
        fromDocumentId: document.id,
        toDocumentId: parent.id,
        linkType: "parent",
        role: null,
        createdAt: new Date("2026-03-01T10:00:00.000Z"),
      },
      {
        id: "link-2",
        fromDocumentId: document.id,
        toDocumentId: dependsOn.id,
        linkType: "depends_on",
        role: null,
        createdAt: new Date("2026-03-01T10:00:00.000Z"),
      },
      {
        id: "link-3",
        fromDocumentId: document.id,
        toDocumentId: compensates.id,
        linkType: "compensates",
        role: null,
        createdAt: new Date("2026-03-01T10:00:00.000Z"),
      },
      {
        id: "link-4",
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
        })
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => []),
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
    expect(result.allowedActions).toEqual(["edit", "submit", "cancel"]);
    expect(result.events).toEqual(events);
    expect(result.snapshot).toEqual(snapshot);
    expect(result.ledgerOperations).toEqual([{ id: "op-1", status: "posted" }]);
    expect(result.computed).toEqual({ label: "computed" });
    expect(result.extra).toEqual({ source: "module" });
  });

  it("returns base details when module details builder fails", async () => {
    const document = makeDocument();
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
            where: vi.fn(async () => []),
          })),
        })
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(async () => []),
          })),
        })
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(async () => []),
          })),
        })
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => []),
            })),
          })),
        })
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => []),
            })),
          })),
        }),
    };
    const ledgerReadService = {
      getOperationDetails: vi.fn(),
    };
    const warn = vi.fn();
    const registry = {
      getDocumentModule: vi.fn(() => ({
        ...createModuleStub(),
        buildDetails: vi.fn(async () => {
          throw new Error("details boom");
        }),
      })),
    };

    const getDetails = createGetDocumentDetailsQuery({
      db,
      ledgerReadService,
      log: { warn } as any,
      registry,
    } as any);

    const result = await getDetails(document.docType, document.id, "checker-1");

    expect(result.document.id).toBe(document.id);
    expect(result.allowedActions).toEqual(["edit", "submit", "cancel"]);
    expect(result.computed).toBeUndefined();
    expect(result.extra).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(
      "documents get details: failed to build module details",
      expect.objectContaining({
        docType: document.docType,
        documentId: document.id,
        error: "details boom",
      }),
    );
  });
});
