import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { createCreateDraftHandler } from "../src/application/commands/create-draft";
import { createTransitionHandler } from "../src/application/commands/transition";
import { createUpdateDraftHandler } from "../src/application/commands/update-draft";
import { createPrepareDocumentPostHandler } from "../src/application/posting/commands";
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
    insertDealLink: vi.fn(async () => undefined),
    findDealIdByDocumentId: vi.fn(async () => null),
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
        approvalMode: vi.fn(async () => "not_required"),
        canCreate: vi.fn(async () => ({ allow: true, reasonCode: "allowed", reasonMeta: null })),
        canEdit: vi.fn(async () => ({ allow: true, reasonCode: "allowed", reasonMeta: null })),
        canSubmit: vi.fn(async () => ({ allow: true, reasonCode: "allowed", reasonMeta: null })),
        canApprove: vi.fn(async () => ({ allow: true, reasonCode: "allowed", reasonMeta: null })),
        canReject: vi.fn(async () => ({ allow: true, reasonCode: "allowed", reasonMeta: null })),
        canPost: vi.fn(async () => ({ allow: true, reasonCode: "allowed", reasonMeta: null })),
        canCancel: vi.fn(async () => ({ allow: true, reasonCode: "allowed", reasonMeta: null })),
      },
      documentBusinessLinks: repository,
      documentEvents: repository,
      documentLinks: repository,
      documentOperations: repository,
      documentSnapshots: repository,
      documentsQuery: repository,
      registry,
      transitionEffects: {
        apply: vi.fn(async () => undefined),
      },
      transactions: {
        withTransaction: vi.fn(async (run: (context: unknown) => Promise<unknown>) =>
          run({
            transaction: repository,
            documentBusinessLinks: repository,
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
    });
    context.policy.approvalMode.mockResolvedValue("maker_checker");
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

  it("uses docNo override returned from module.createDraft", async () => {
    const moduleStub = createModuleStub({
      async createDraft() {
        return {
          occurredAt: new Date("2026-03-01T12:00:00.000Z"),
          payload: { memo: "created" },
          docNo: "INV-CUSTOM-2026-001",
        };
      },
    });
    const { context, insertedRows } = createContext({
      module: moduleStub,
      selectRows: [[]],
    });
    const handler = createCreateDraftHandler(context as any);

    await handler({
      docType: "test_document",
      createIdempotencyKey: "create-idem-docno",
      payload: { memo: "created" },
      actorUserId: "maker-1",
    });

    expect(insertedRows[0]).toEqual(
      expect.objectContaining({ docNo: "INV-CUSTOM-2026-001" }),
    );
  });

  it("throws a friendly error when a custom docNo collides with an existing document", async () => {
    const moduleStub = createModuleStub({
      async createDraft() {
        return {
          occurredAt: new Date("2026-03-01T12:00:00.000Z"),
          payload: { memo: "created" },
          docNo: "INV-DUP-1",
        };
      },
    });
    const { context, repository } = createContext({
      module: moduleStub,
      selectRows: [[]],
    });
    repository.insertDocument.mockResolvedValueOnce(null as never);
    repository.findDocumentByCreateIdempotencyKey.mockResolvedValueOnce(
      null as never,
    );

    const handler = createCreateDraftHandler(context as any);

    await expect(
      handler({
        docType: "test_document",
        createIdempotencyKey: "create-idem-dup",
        payload: { memo: "created" },
        actorUserId: "maker-1",
      }),
    ).rejects.toThrow('Документ с номером "INV-DUP-1" уже существует');
  });

  it("updates active draft documents", async () => {
    const document = makeDocument();
    const { context } = createContext({
      document,
      selectRows: [[document]],
    });
    context.policy.approvalMode.mockResolvedValue("maker_checker");
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

  it("bypasses pending approval before posting when the actor is approval-exempt", async () => {
    const document = makeDocument({
      submissionStatus: "submitted",
      approvalStatus: "pending",
    });
    const module = createModuleStub({
      async buildPostingPlan() {
        return {
          operationCode: "TEST_POST",
          payload: {},
          requests: [
            {
              templateKey: "TC.1001",
              effectiveAt: new Date("2026-03-01T10:00:00.000Z"),
              currency: "USD",
              amountMinor: 100n,
              bookRefs: {
                bookId: "book-1",
              },
              dimensions: {},
            },
          ],
        };
      },
    });
    const { context, repository } = createContext({
      document,
      module,
      selectRows: [[document]],
    });
    let currentDocument = document;
    repository.updateDocument.mockImplementation(
      async ({ patch }: { patch: Record<string, unknown> }) => {
        currentDocument = {
          ...currentDocument,
          ...patch,
          updatedAt: context.now(),
          version: currentDocument.version + 1,
        } as Document;

        return currentDocument;
      },
    );
    context.policy.approvalMode.mockResolvedValue("not_required");
    context.accounting.resolvePostingPlan.mockResolvedValue({
      intent: {
        idempotencyKey: "post-idem",
        source: {
          type: "documents/test_document/post",
          id: document.id,
        },
        postings: [],
      },
      packChecksum: "pack-1",
      postingPlanChecksum: "posting-plan-1",
      journalIntentChecksum: "journal-intent-1",
      appliedTemplates: [],
    });

    const handler = createPrepareDocumentPostHandler(context as any);
    const result = await handler({
      action: "post",
      docType: document.docType,
      documentId: document.id,
      actorUserId: "admin-1",
    });

    expect(repository.updateDocument).toHaveBeenCalledTimes(2);
    expect(repository.updateDocument.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        patch: expect.objectContaining({
          approvalStatus: "not_required",
        }),
      }),
    );
    expect(repository.updateDocument.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({
        patch: expect.objectContaining({
          postingStatus: "posting",
        }),
      }),
    );
    expect(result.document.approvalStatus).toBe("not_required");
    expect(result.document.postingStatus).toBe("posting");
    expect(result.successEvents).toEqual([
      expect.objectContaining({
        eventType: "approval_bypassed",
      }),
    ]);
  });

});
