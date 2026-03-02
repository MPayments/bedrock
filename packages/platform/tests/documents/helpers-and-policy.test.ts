import { describe, expect, it, vi } from "vitest";

import { schema, type Document } from "@bedrock/db/schema/documents";
import { InvalidStateError } from "@bedrock/foundation/kernel/errors";

import { DocumentGraphError, DocumentPolicyDeniedError, DocumentRegistryError } from "../../src/documents/errors";
import {
  assertDocumentIsActive,
  buildDefaultActionIdempotencyKey,
  buildDocNo,
  buildDocumentEventState,
  buildDocumentSearchCondition,
  buildSummary,
  createDocumentInsertBase,
  createModuleContext,
  getLatestPostingArtifacts,
  inArraySafe,
  insertDocumentEvent,
  insertInitialLinks,
  normalizeSearchText,
  resolveDocumentModuleIdentity,
  resolveDocumentsSort,
  resolveModule,
  toStoredJson,
} from "../../src/documents/internal/helpers";
import { enforceDocumentPolicy, persistDocumentPolicyDenial } from "../../src/documents/internal/policy";
import type { DocumentActionPolicyService, DocumentModule } from "../../src/documents/types";

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
    amountMinor: 100n,
    currency: "USD",
    memo: "hello",
    counterpartyId: "cp-1",
    customerId: "cust-1",
    operationalAccountId: "oa-1",
    searchText: "test document",
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
    buildPostIdempotencyKey() {
      return "post-idem";
    },
  };
}

function createPolicyStub(): DocumentActionPolicyService {
  return {
    approvalMode: vi.fn(async () => "not_required"),
    canCreate: vi.fn(async () => ({ allow: true, reasonCode: "allowed", reasonMeta: null })),
    canEdit: vi.fn(async () => ({ allow: true, reasonCode: "allowed", reasonMeta: null })),
    canSubmit: vi.fn(async () => ({ allow: true, reasonCode: "allowed", reasonMeta: null })),
    canApprove: vi.fn(async () => ({ allow: true, reasonCode: "allowed", reasonMeta: null })),
    canReject: vi.fn(async () => ({ allow: true, reasonCode: "allowed", reasonMeta: null })),
    canPost: vi.fn(async () => ({ allow: true, reasonCode: "allowed", reasonMeta: null })),
    canCancel: vi.fn(async () => ({ allow: true, reasonCode: "allowed", reasonMeta: null })),
  };
}

describe("document helpers", () => {
  it("formats document numbers and normalizes search metadata", () => {
    expect(buildDocNo("inv", "abcdef12-3456-7890-abcd-ef1234567890")).toBe(
      "inv-ABCDEF12",
    );
    expect(normalizeSearchText("  Hello   WORLD  ")).toBe("hello world");
    expect(
      buildSummary({
        title: "Invoice",
        searchText: "  Hello   WORLD  ",
      }),
    ).toEqual({
      title: "Invoice",
      amountMinor: null,
      currency: null,
      memo: null,
      counterpartyId: null,
      customerId: null,
      operationalAccountId: null,
      searchText: "hello world",
    });
  });

  it("guards active-document actions", () => {
    expect(() => assertDocumentIsActive(makeDocument(), "submitted")).not.toThrow();
    expect(() =>
      assertDocumentIsActive(
        makeDocument({ lifecycleStatus: "cancelled" }),
        "submitted",
      ),
    ).toThrow(InvalidStateError);
  });

  it("resolves modules and wraps registry misses", () => {
    const module = createModuleStub();
    const registry = {
      getDocumentModule: vi.fn((docType: string) => {
        if (docType === module.docType) {
          return module;
        }
        throw new Error("missing");
      }),
    };

    expect(resolveModule(registry as any, module.docType)).toBe(module);
    expect(() => resolveModule(registry as any, "missing")).toThrow(
      DocumentRegistryError,
    );
  });

  it("creates module context and document base rows with current defaults", () => {
    const now = new Date("2026-03-01T12:00:00.000Z");
    const context = createModuleContext({
      db: {} as any,
      actorUserId: "user-1",
      now,
      log: {} as any,
    });
    expect(context.actorUserId).toBe("user-1");
    expect(context.now).toBe(now);

    const inserted = createDocumentInsertBase({
      id: "doc-123",
      docType: "invoice",
      docNoPrefix: "INV",
      moduleId: "invoice",
      moduleVersion: 2,
      payloadVersion: 3,
      payload: { amountMinor: 1000 },
      occurredAt: now,
      createIdempotencyKey: "idem-1",
      createdBy: "user-1",
      approvalStatus: "pending",
      postingStatus: "unposted",
    });

    expect(inserted.id).toBe("doc-123");
    expect(inserted.docNo).toBe("INV-DOC-123");
    expect(inserted.submissionStatus).toBe("draft");
    expect(inserted.lifecycleStatus).toBe("active");
    expect(inserted.version).toBe(1);
  });

  it("resolves module identity defaults and overrides", () => {
    expect(resolveDocumentModuleIdentity(createModuleStub())).toEqual({
      moduleId: "test_document",
      moduleVersion: 1,
    });

    expect(
      resolveDocumentModuleIdentity({
        ...createModuleStub(),
        moduleId: "documents",
        moduleVersion: 3,
      }),
    ).toEqual({
      moduleId: "documents",
      moduleVersion: 3,
    });
  });

  it("builds deterministic action idempotency keys and stored JSON payloads", () => {
    expect(
      buildDefaultActionIdempotencyKey("documents.submit", {
        documentId: "doc-1",
        actorUserId: "user-1",
      }),
    ).toBe(
      buildDefaultActionIdempotencyKey("documents.submit", {
        actorUserId: "user-1",
        documentId: "doc-1",
      }),
    );

    expect(
      toStoredJson({
        amountMinor: 10n,
        memo: undefined,
      }),
    ).toEqual({
      amountMinor: "10",
    });
  });

  it("builds document event snapshots from stored documents", () => {
    const state = buildDocumentEventState(makeDocument());

    expect(state).toEqual({
      id: "11111111-1111-4111-8111-111111111111",
      docType: "test_document",
      docNo: "TST-11111111",
      moduleId: "test_document",
      moduleVersion: 1,
      payloadVersion: 1,
      title: "Test document",
      occurredAt: new Date("2026-03-01T10:00:00.000Z"),
      submissionStatus: "draft",
      approvalStatus: "not_required",
      postingStatus: "unposted",
      lifecycleStatus: "active",
      amountMinor: 100n,
      currency: "USD",
      memo: "hello",
      version: 1,
      postingError: null,
      postingStartedAt: null,
      postedAt: null,
      updatedAt: new Date("2026-03-01T10:00:00.000Z"),
    });
  });

  it("persists normalized document events and reads latest posting artifacts", async () => {
    let insertedEvent: Record<string, unknown> | undefined;
    const tx = {
      insert: vi.fn(() => ({
        values: vi.fn(async (values: Record<string, unknown>) => {
          insertedEvent = values;
        }),
      })),
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(() => ({
              limit: vi.fn(async () => [
                { reasonMeta: { packChecksum: "pack-1" } },
              ]),
            })),
          })),
        })),
      })),
    };

    await insertDocumentEvent(tx as any, {
      documentId: "doc-1",
      eventType: "post",
      reasonMeta: { amountMinor: 10n, skip: undefined },
      before: { status: "draft", skip: undefined },
      after: { status: "submitted" },
    });

    expect(insertedEvent).toEqual(
      expect.objectContaining({
        documentId: "doc-1",
        eventType: "post",
        reasonMeta: { amountMinor: "10" },
        before: { status: "draft" },
        after: { status: "submitted" },
      }),
    );

    await expect(getLatestPostingArtifacts(tx as any, "doc-1")).resolves.toEqual({
      packChecksum: "pack-1",
    });
  });

  it("builds list helpers for search, array filters, and sorting", () => {
    expect(buildDocumentSearchCondition(undefined)).toBeUndefined();
    expect(buildDocumentSearchCondition("  Invoice 123 ")).toBeDefined();
    expect(inArraySafe(schema.documents.docType, undefined)).toBeUndefined();
    expect(inArraySafe(schema.documents.docType, [])).toBeUndefined();
    expect(inArraySafe(schema.documents.docType, ["invoice"])).toBeDefined();
    expect(resolveDocumentsSort("createdAt", "asc")).toBeDefined();
    expect(resolveDocumentsSort("postedAt", "desc")).toBeDefined();
  });

  it("inserts initial links and blocks invalid graphs", async () => {
    const insertedLinks: Record<string, unknown>[] = [];
    const tx = {
      execute: vi.fn(async () => ({ rows: [] })),
      insert: vi.fn(() => ({
        values: vi.fn((values: Record<string, unknown>) => ({
          onConflictDoNothing: vi.fn(async () => {
            insertedLinks.push(values);
          }),
        })),
      })),
    };
    const document = makeDocument();

    await insertInitialLinks(tx as any, document, [
      {
        toDocumentId: "22222222-2222-4222-8222-222222222222",
        linkType: "parent",
      },
      {
        toDocumentId: "33333333-3333-4333-8333-333333333333",
        linkType: "related",
        role: "supporting",
      },
    ]);

    expect(tx.execute).toHaveBeenCalledTimes(1);
    expect(insertedLinks).toEqual([
      {
        fromDocumentId: document.id,
        toDocumentId: "22222222-2222-4222-8222-222222222222",
        linkType: "parent",
        role: null,
      },
      {
        fromDocumentId: document.id,
        toDocumentId: "33333333-3333-4333-8333-333333333333",
        linkType: "related",
        role: "supporting",
      },
    ]);

    await expect(
      insertInitialLinks(tx as any, document, [
        { toDocumentId: document.id, linkType: "parent" },
      ]),
    ).rejects.toThrow(DocumentGraphError);

    tx.execute.mockResolvedValueOnce({ rows: [{ id: 1 }] });
    await expect(
      insertInitialLinks(tx as any, document, [
        {
          toDocumentId: "44444444-4444-4444-8444-444444444444",
          linkType: "depends_on",
        },
      ]),
    ).rejects.toThrow("would create a cycle");
  });
});

describe("document internal policy", () => {
  it("routes allow decisions through the matching policy method", async () => {
    const policy = createPolicyStub();
    const module = createModuleStub();

    await expect(
      enforceDocumentPolicy({
        policy,
        action: "create",
        module,
        actorUserId: "user-1",
        moduleContext: {} as any,
        payload: { memo: "draft" },
      }),
    ).resolves.toBeUndefined();

    expect(policy.canCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: "user-1",
        payload: { memo: "draft" },
      }),
    );
  });

  it("records audited policy denials for document actions", async () => {
    const policy = createPolicyStub();
    const document = makeDocument();
    let insertedEvent: Record<string, unknown> | undefined;
    const tx = {
      insert: vi.fn(() => ({
        values: vi.fn(async (values: Record<string, unknown>) => {
          insertedEvent = values;
        }),
      })),
    };
    const db = {
      transaction: vi.fn(async (fn: (tx: typeof tx) => Promise<void>) => fn(tx)),
    };

    policy.canApprove = vi.fn(async () => ({
      allow: false,
      reasonCode: "blocked",
      reasonMeta: { scope: "approval" },
    }));

    let error: unknown;
    try {
      await enforceDocumentPolicy({
        policy,
        action: "approve",
        module: createModuleStub(),
        actorUserId: "checker-1",
        moduleContext: {} as any,
        document,
        requestContext: {
          requestId: "req-1",
          correlationId: "corr-1",
          traceId: "trace-1",
          causationId: "cause-1",
        },
      });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(DocumentPolicyDeniedError);
    await persistDocumentPolicyDenial(db as any, error);

    expect(insertedEvent).toEqual(
      expect.objectContaining({
        documentId: document.id,
        eventType: "policy_denied",
        actorId: "checker-1",
        requestId: "req-1",
        correlationId: "corr-1",
        traceId: "trace-1",
        causationId: "cause-1",
        reasonCode: "blocked",
        reasonMeta: {
          action: "approve",
          scope: "approval",
        },
      }),
    );
  });

  it("skips persistence for non-audited errors and create denials without a document id", async () => {
    const db = {
      transaction: vi.fn(),
    };

    await persistDocumentPolicyDenial(db as any, new Error("plain failure"));
    expect(db.transaction).not.toHaveBeenCalled();

    const policy = createPolicyStub();
    policy.canCreate = vi.fn(async () => ({
      allow: false,
      reasonCode: "blocked",
      reasonMeta: null,
    }));

    let error: unknown;
    try {
      await enforceDocumentPolicy({
        policy,
        action: "create",
        module: createModuleStub(),
        actorUserId: "user-1",
        moduleContext: {} as any,
        payload: { memo: "draft" },
      });
    } catch (caught) {
      error = caught;
    }

    await persistDocumentPolicyDenial(db as any, error);
    expect(db.transaction).not.toHaveBeenCalled();
  });
});
