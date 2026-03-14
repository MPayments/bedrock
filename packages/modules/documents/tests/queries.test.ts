import { describe, expect, it, vi } from "vitest";

import { buildTestDocument, createTestDocumentModule } from "./helpers";
import { createGetDocumentQuery } from "../src/application/queries/get-document";
import { createGetDocumentDetailsQuery } from "../src/application/queries/get-document-details";
import { createListDocumentsQuery } from "../src/application/queries/list-documents";
import type {
  Document,
  DocumentEvent,
  DocumentLink,
  DocumentOperation,
  DocumentSnapshot,
} from "../src/domain/types";
import { DocumentNotFoundError } from "../src/errors";
import type { DocumentModule } from "../src/types";

const makeDocument = (overrides: Partial<Document> = {}) =>
  buildTestDocument(overrides);
const createModuleStub = () => createTestDocumentModule() as DocumentModule;

function createRepositoryStub(overrides: Record<string, unknown> = {}) {
  return {
    findDocumentByType: vi.fn(),
    findDocumentWithPostingOperation: vi.fn(),
    findDocumentByCreateIdempotencyKey: vi.fn(),
    findPostingOperationId: vi.fn(),
    insertDocument: vi.fn(),
    updateDocument: vi.fn(),
    insertDocumentOperation: vi.fn(),
    resetPostingOperation: vi.fn(),
    insertDocumentEvent: vi.fn(),
    insertInitialLinks: vi.fn(),
    listDocuments: vi.fn(async () => ({ rows: [], total: 0 })),
    listDocumentLinks: vi.fn(async () => []),
    listDocumentsByIds: vi.fn(async () => []),
    listDocumentOperations: vi.fn(async () => []),
    listDocumentEvents: vi.fn(async () => []),
    findDocumentSnapshot: vi.fn(async () => null),
    getLatestPostingArtifacts: vi.fn(async () => null),
    ...overrides,
  };
}

describe("documents queries", () => {
  it("loads a single document with its posting operation id", async () => {
    const document = makeDocument();
    const repository = createRepositoryStub({
      findDocumentWithPostingOperation: vi.fn(async () => ({
        document,
        postingOperationId: "op-1",
      })),
    });

    const getDocument = createGetDocumentQuery({ repository } as any);

    await expect(
      getDocument(document.docType, document.id),
    ).resolves.toEqual({
      document,
      postingOperationId: "op-1",
      allowedActions: [],
    });
  });

  it("raises not found for missing document queries", async () => {
    const repository = createRepositoryStub({
      findDocumentWithPostingOperation: vi.fn(async () => null),
    });

    const getDocument = createGetDocumentQuery({ repository } as any);
    await expect(getDocument("test_document", "missing")).rejects.toThrow(
      DocumentNotFoundError,
    );
  });

  it("hides direct-post actions when submit policy denies the draft precondition", async () => {
    const document = makeDocument({
      submissionStatus: "draft",
      approvalStatus: "not_required",
      postingStatus: "unposted",
      counterpartyId: null,
      customerId: null,
      organizationRequisiteId: null,
      payload: {},
    });
    const module = {
      ...createModuleStub(),
      allowDirectPostFromDraft: true,
      canSubmit: vi.fn(async () => undefined),
      canPost: vi.fn(async () => undefined),
    };
    const repository = createRepositoryStub({
      findDocumentWithPostingOperation: vi.fn(async () => ({
        document,
        postingOperationId: null,
      })),
    });
    const policy = {
      approvalMode: vi.fn(),
      canCreate: vi.fn(),
      canEdit: vi.fn(async () => ({
        allow: true,
        reasonCode: "allowed",
        reasonMeta: null,
      })),
      canSubmit: vi.fn(async () => ({
        allow: false,
        reasonCode: "maker_only",
        reasonMeta: null,
      })),
      canApprove: vi.fn(),
      canReject: vi.fn(),
      canPost: vi.fn(async () => ({
        allow: true,
        reasonCode: "allowed",
        reasonMeta: null,
      })),
      canCancel: vi.fn(async () => ({
        allow: true,
        reasonCode: "allowed",
        reasonMeta: null,
      })),
    };
    const registry = {
      getDocumentModule: vi.fn(() => module),
    };
    const getDocument = createGetDocumentQuery({
      accountingPeriods: {
        isOrganizationPeriodClosed: vi.fn(async () => false),
      },
      log: {} as any,
      moduleDb: {} as any,
      policy,
      registry,
      repository,
    } as any);

    const result = await getDocument(document.docType, document.id, "maker-1");

    expect(result.allowedActions).toEqual(["edit", "cancel"]);
    expect(module.canSubmit).toHaveBeenCalledTimes(1);
    expect(module.canPost).toHaveBeenCalledTimes(1);
    expect(policy.canSubmit).toHaveBeenCalledTimes(1);
    expect(policy.canPost).not.toHaveBeenCalled();
  });

  it("lists documents with the current pagination mapping", async () => {
    const document = makeDocument();
    const repository = createRepositoryStub({
      listDocuments: vi.fn(async () => ({
        rows: [{ document, postingOperationId: null }],
        total: 1,
      })),
    });

    const listDocuments = createListDocumentsQuery({ repository } as any);
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
    const repository = createRepositoryStub({
      findDocumentByType: vi.fn(async () => document),
      listDocumentLinks: vi.fn(async () => links),
      listDocumentsByIds: vi.fn(async () => [parent, child, dependsOn, compensates]),
      listDocumentOperations: vi.fn(async () => documentOperations),
      listDocumentEvents: vi.fn(async () => events),
      findDocumentSnapshot: vi.fn(async () => snapshot),
    });
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
      accountingPeriods: {
        isOrganizationPeriodClosed: vi.fn(async () => false),
      },
      ledgerReadService,
      log: {} as any,
      moduleDb: {} as any,
      registry,
      repository,
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
    const repository = createRepositoryStub({
      findDocumentByType: vi.fn(async () => document),
    });
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
      accountingPeriods: {
        isOrganizationPeriodClosed: vi.fn(async () => false),
      },
      ledgerReadService,
      log: { warn } as any,
      moduleDb: {} as any,
      registry,
      repository,
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
