import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { createCreateDraftHandler } from "../src/application/commands/create-draft";
import { createTransitionHandler } from "../src/application/commands/transition";
import { createUpdateDraftHandler } from "../src/application/commands/update-draft";
import type { Document } from "../src/domain/document";
import type { DocumentModule } from "../src/plugins";

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
    organizationRequisiteId: null,
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

function createModuleStub(
  overrides: Partial<DocumentModule<{ memo: string }, { memo: string }>> = {},
): DocumentModule<{ memo: string }, { memo: string }> {
  const payloadSchema = z.object({ memo: z.string() });

  return {
    docType: "test_document",
    docNoPrefix: "TST",
    payloadVersion: 1,
    createSchema: payloadSchema,
    updateSchema: payloadSchema,
    payloadSchema,
    postingRequired: true,
    approvalRequired: () => false,
    async createDraft() {
      return {
        occurredAt: new Date("2026-03-01T12:00:00.000Z"),
        payload: { memo: "created" },
      };
    },
    async updateDraft() {
      return {
        occurredAt: new Date("2026-03-02T12:00:00.000Z"),
        payload: { memo: "updated" },
      };
    },
    deriveSummary(document) {
      return {
        title: String((document.payload as Record<string, string>).memo),
        memo: String((document.payload as Record<string, string>).memo),
        searchText: `memo ${String((document.payload as Record<string, string>).memo)}`,
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
    ...overrides,
  };
}

function createContext(options: {
  document?: Document;
  module?: DocumentModule<{ memo: string }, { memo: string }>;
  selectRows?: unknown[][];
  insertDocumentResult?: Document;
  updateDocumentResult?: Document;
  postingOperationId?: string | null;
  periodClosed?: boolean;
}) {
  const module = options.module ?? createModuleStub();
  const selectRows = [...(options.selectRows ?? [])];
  const eventRows: Record<string, unknown>[] = [];
  const insertedRows: Record<string, unknown>[] = [];
  const now = new Date("2026-03-03T00:00:00.000Z");

  function buildStoredDocument(values: Record<string, unknown>): Document {
    const base = options.document ?? makeDocument();

    return {
      ...base,
      ...values,
      updatedAt: now,
      version: base.version + 1,
      cancelledAt: values.cancelledAt ? now : base.cancelledAt,
      postingStartedAt: values.postingStartedAt ? now : base.postingStartedAt,
      approvedAt: values.approvedAt ? now : base.approvedAt,
      rejectedAt: values.rejectedAt ? now : base.rejectedAt,
      submittedAt: values.submittedAt ? now : base.submittedAt,
    } as Document;
  }

  const repository = {
    findDocumentByType: vi.fn(async () => {
      const rows = selectRows.shift() ?? [];
      return (rows[0] as Document | undefined) ?? null;
    }),
    findDocumentWithPostingOperation: vi.fn(async () => {
      const rows = selectRows.shift() ?? [];
      return (rows[0] as { document: Document; postingOperationId: string | null } | undefined) ?? null;
    }),
    findDocumentByCreateIdempotencyKey: vi.fn(async () => {
      const rows = selectRows.shift() ?? [];
      return (rows[0] as Document | undefined) ?? null;
    }),
    findPostingOperationId: vi.fn(async () => {
      const rows = selectRows.shift() ?? [];
      const row = rows[0] as { operationId?: string } | undefined;
      return row?.operationId ?? options.postingOperationId ?? null;
    }),
    insertDocument: vi.fn(async (values: Record<string, unknown>) => {
      insertedRows.push(values);
      return options.insertDocumentResult ?? (values as Document);
    }),
    updateDocument: vi.fn(async ({ patch }: { patch: Record<string, unknown> }) =>
      options.updateDocumentResult ?? buildStoredDocument(patch),
    ),
    insertDocumentOperation: vi.fn(async () => undefined),
    resetPostingOperation: vi.fn(async () => undefined),
    insertDocumentEvent: vi.fn(async (values: Record<string, unknown>) => {
      eventRows.push(values);
    }),
    insertInitialLinks: vi.fn(async () => undefined),
    listDocuments: vi.fn(async () => ({ rows: [], total: 0 })),
    listDocumentLinks: vi.fn(async () => []),
    listDocumentsByIds: vi.fn(async () => []),
    listDocumentOperations: vi.fn(async () => []),
    listDocumentEvents: vi.fn(async () => []),
    findDocumentSnapshot: vi.fn(async () => null),
    getLatestPostingArtifacts: vi.fn(async () => null),
  };
  const idempotency = {
    withIdempotency: vi.fn(async ({ handler }: { handler: () => Promise<unknown> }) =>
      handler(),
    ),
  };
  const ledger = {
    commit: vi.fn(),
  };
  const registry = {
    getDocumentModule: vi.fn(() => module),
  };

  return {
    context: {
      accounting: {
        resolvePostingPlan: vi.fn(),
      },
      accountingPeriods: {
        assertOrganizationPeriodsOpen: vi.fn(async () => {
          if (options.periodClosed) {
            throw new Error("Accounting period is closed for organization");
          }
        }),
        closePeriod: vi.fn(async () => undefined),
        isOrganizationPeriodClosed: vi.fn(
          async () => options.periodClosed ?? false,
        ),
        listClosedOrganizationIdsForPeriod: vi.fn(async () => []),
        reopenPeriod: vi.fn(async () => undefined),
      },
      moduleRuntime: {} as any,
      ledgerReadService: {
        listOperationDetails: vi.fn(async () => new Map()),
      } as any,
      now: () => now,
      log: {
        debug: vi.fn(),
      },
      policy: {
        approvalMode: vi.fn(),
        canCreate: vi.fn(async () => ({ allow: true, reasonCode: "allowed", reasonMeta: null })),
        canEdit: vi.fn(async () => ({ allow: true, reasonCode: "allowed", reasonMeta: null })),
        canSubmit: vi.fn(async () => ({ allow: true, reasonCode: "allowed", reasonMeta: null })),
        canApprove: vi.fn(async () => ({ allow: true, reasonCode: "allowed", reasonMeta: null })),
        canReject: vi.fn(async () => ({ allow: true, reasonCode: "allowed", reasonMeta: null })),
        canPost: vi.fn(async () => ({ allow: true, reasonCode: "allowed", reasonMeta: null })),
        canCancel: vi.fn(async () => ({ allow: true, reasonCode: "allowed", reasonMeta: null })),
      },
      documentEvents: repository,
      documentLinks: repository,
      documentOperations: repository,
      documentSnapshots: repository,
      documentsQuery: repository,
      registry,
      transactions: {
        withTransaction: vi.fn(async (run: (context: unknown) => Promise<unknown>) =>
          run({
            documentEvents: repository,
            documentLinks: repository,
            documentOperations: repository,
            documentsCommand: repository,
            idempotency,
            moduleRuntime: {} as any,
            ledger,
          }),
        ),
      },
    },
    idempotency,
    repository,
    ledger,
    insertedRows,
    eventRows,
  };
}

describe("documents command flows", () => {
  it("creates a draft document with derived summary fields", async () => {
    const { context, insertedRows, idempotency } = createContext({
      selectRows: [[]],
      module: createModuleStub({
        approvalRequired: () => true,
      }),
    });
    const handler = createCreateDraftHandler(context as any);

    const result = await handler({
      docType: "test_document",
      createIdempotencyKey: "create-idem",
      payload: { memo: "created" },
      actorUserId: "maker-1",
    });

    expect(idempotency.withIdempotency).toHaveBeenCalled();
    expect(insertedRows[0]).toEqual(
      expect.objectContaining({
        docType: "test_document",
        approvalStatus: "pending",
        postingStatus: "unposted",
        title: "created",
        memo: "created",
        searchText: "memo created",
      }),
    );
    expect(result.document.docType).toBe("test_document");
    expect(result.postingOperationId).toBeNull();
  });

  it("updates active draft documents", async () => {
    const document = makeDocument();
    const { context } = createContext({
      document,
      selectRows: [[document]],
      module: createModuleStub({
        approvalRequired: () => true,
      }),
    });
    const handler = createUpdateDraftHandler(context as any);

    const result = await handler({
      docType: document.docType,
      documentId: document.id,
      payload: { memo: "updated" },
      actorUserId: "maker-1",
    });

    expect(result.document.payload).toEqual({ memo: "updated" });
    expect(result.document.approvalStatus).toBe("pending");
    expect(result.document.title).toBe("updated");
  });

  it("blocks updates when the document period is closed", async () => {
    const document = makeDocument({
      payload: { organizationId: "00000000-0000-4000-8000-000000000777" },
    });
    const { context } = createContext({
      document,
      selectRows: [[document]],
      periodClosed: true,
    });
    const handler = createUpdateDraftHandler(context as any);

    await expect(
      handler({
        docType: document.docType,
        documentId: document.id,
        payload: { memo: "updated" },
        actorUserId: "maker-1",
      }),
    ).rejects.toThrow("is closed for organization");
  });

  it("cancels active unposted documents", async () => {
    const document = makeDocument({
      postingStatus: "failed",
    });
    const { context } = createContext({
      document,
      selectRows: [[document]],
    });
    const transition = createTransitionHandler(context as any);

    const result = await transition({
      action: "cancel",
      docType: document.docType,
      documentId: document.id,
      actorUserId: "maker-1",
    });

    expect(result.document.lifecycleStatus).toBe("cancelled");
    expect(result.document.cancelledBy).toBe("maker-1");
  });

});
