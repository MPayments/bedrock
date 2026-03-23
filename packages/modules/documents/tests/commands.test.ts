import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { CreateDraftCommand } from "../src/documents/application/commands/create-draft";
import { UpdateDraftCommand } from "../src/documents/application/commands/update-draft";
import type { DocumentSnapshot } from "../src/documents/domain/document";
import { ExecuteDocumentTransitionCommand } from "../src/lifecycle/application/commands/transition";
import type { DocumentModule } from "../src/plugins";
import { PrepareDocumentPostCommand } from "../src/posting/application/commands/prepare-document-post";

function makeDocument(
  overrides: Partial<DocumentSnapshot> = {},
): DocumentSnapshot {
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
        summary: {
          title: "created",
          memo: "created",
          searchText: "memo created",
        },
      };
    },
    async updateDraft() {
      return {
        occurredAt: new Date("2026-03-02T12:00:00.000Z"),
        payload: { memo: "updated" },
        summary: {
          title: "updated",
          memo: "updated",
          searchText: "memo updated",
        },
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
  document?: DocumentSnapshot;
  module?: DocumentModule<{ memo: string }, { memo: string }>;
  selectRows?: unknown[][];
  insertDocumentResult?: DocumentSnapshot;
  updateDocumentResult?: DocumentSnapshot;
  postingOperationId?: string | null;
  periodClosed?: boolean;
}) {
  const module = options.module ?? createModuleStub();
  const selectRows = [...(options.selectRows ?? [])];
  const eventRows: Record<string, unknown>[] = [];
  const insertedRows: Record<string, unknown>[] = [];
  const now = new Date("2026-03-03T00:00:00.000Z");

  function buildStoredDocument(
    values: Record<string, unknown>,
  ): DocumentSnapshot {
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
    } as DocumentSnapshot;
  }

  const repository = {
    findDocumentByType: vi.fn(async () => {
      const rows = selectRows.shift() ?? [];
      return (rows[0] as DocumentSnapshot | undefined) ?? null;
    }),
    findDocumentWithPostingOperation: vi.fn(async () => {
      const rows = selectRows.shift() ?? [];
      return (
        rows[0] as
          | { document: DocumentSnapshot; postingOperationId: string | null }
          | undefined
      ) ?? null;
    }),
    findDocumentByCreateIdempotencyKey: vi.fn(async () => {
      const rows = selectRows.shift() ?? [];
      return (rows[0] as DocumentSnapshot | undefined) ?? null;
    }),
    findPostingOperationId: vi.fn(async () => {
      const rows = selectRows.shift() ?? [];
      const row = rows[0] as { operationId?: string } | undefined;
      return row?.operationId ?? options.postingOperationId ?? null;
    }),
    insertDocument: vi.fn(async (values: Record<string, unknown>) => {
      insertedRows.push(values);
      return options.insertDocumentResult ?? (values as DocumentSnapshot);
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
  const moduleRuntime = {
    documents: {
      findIncomingLinkedDocument: vi.fn(async () => null),
      getDocumentByType: vi.fn(async () => null),
      getDocumentOperationId: vi.fn(async () => null),
    },
  };
  const registry = {
    getDocumentModule: vi.fn(() => module),
    getDocumentModules: vi.fn(() => [module]),
  };
  const runtime = {
    generateUuid: vi.fn(
      () => "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    ),
    now: () => now,
    log: {
      debug: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
      child: vi.fn(),
    },
  };
  const commandUow = {
    run: vi.fn(async (run: (tx: unknown) => Promise<unknown>) =>
      run({
        transaction: repository,
        documentsCommand: repository,
        documentEvents: repository,
        documentLinks: repository,
        documentOperations: repository,
        idempotency,
        moduleRuntime,
      }),
    ),
  };
  const policy = {
    approvalMode: vi.fn(async () => "not_required"),
    canCreate: vi.fn(async () => ({ allow: true, reasonCode: "allowed", reasonMeta: null })),
    canEdit: vi.fn(async () => ({ allow: true, reasonCode: "allowed", reasonMeta: null })),
    canSubmit: vi.fn(async () => ({ allow: true, reasonCode: "allowed", reasonMeta: null })),
    canApprove: vi.fn(async () => ({ allow: true, reasonCode: "allowed", reasonMeta: null })),
    canReject: vi.fn(async () => ({ allow: true, reasonCode: "allowed", reasonMeta: null })),
    canPost: vi.fn(async () => ({ allow: true, reasonCode: "allowed", reasonMeta: null })),
    canCancel: vi.fn(async () => ({ allow: true, reasonCode: "allowed", reasonMeta: null })),
  };
  const accountingPeriods = {
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
  };
  const accounting = {
    resolvePostingPlan: vi.fn(),
  };
  const lifecycleDeps = {
    runtime,
    commandUow,
    accountingPeriods,
    registry,
    policy,
    transitionEffects: {
      apply: vi.fn(async () => undefined),
    },
  };

  return {
    accounting,
    accountingPeriods,
    commandUow,
    idempotency,
    lifecycleDeps,
    policy,
    repository,
    registry,
    runtime,
    insertedRows,
    eventRows,
  };
}

describe("documents command flows", () => {
  it("creates a draft document with derived summary fields", async () => {
    const { accountingPeriods, commandUow, idempotency, insertedRows, policy, registry, runtime } = createContext({
      selectRows: [[]],
    });
    policy.approvalMode.mockResolvedValue("maker_checker");
    const handler = new CreateDraftCommand(
      runtime as any,
      commandUow as any,
      accountingPeriods as any,
      registry as any,
      policy as any,
    );

    const result = await handler.execute({
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
    const { accountingPeriods, commandUow, policy, registry, runtime } = createContext({
      document,
      selectRows: [[document]],
    });
    policy.approvalMode.mockResolvedValue("maker_checker");
    const handler = new UpdateDraftCommand(
      runtime as any,
      commandUow as any,
      accountingPeriods as any,
      registry as any,
      policy as any,
    );

    const result = await handler.execute({
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
    const { accountingPeriods, commandUow, policy, registry, runtime } = createContext({
      document,
      selectRows: [[document]],
      periodClosed: true,
    });
    const handler = new UpdateDraftCommand(
      runtime as any,
      commandUow as any,
      accountingPeriods as any,
      registry as any,
      policy as any,
    );

    await expect(
      handler.execute({
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
    const { lifecycleDeps } = createContext({
      document,
      selectRows: [[document]],
    });
    const transition = new ExecuteDocumentTransitionCommand(
      lifecycleDeps as any,
    );

    const result = await transition.execute({
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
    const { accounting, accountingPeriods, commandUow, policy, registry, repository, runtime } = createContext({
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
          updatedAt: runtime.now(),
          version: currentDocument.version + 1,
        } as DocumentSnapshot;

        return currentDocument;
      },
    );
    policy.approvalMode.mockResolvedValue("not_required");
    accounting.resolvePostingPlan.mockResolvedValue({
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

    const handler = new PrepareDocumentPostCommand(
      runtime as any,
      commandUow as any,
      accounting as any,
      accountingPeriods as any,
      registry as any,
      policy as any,
    );
    const result = await handler.execute({
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
