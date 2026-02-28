import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { schema, type Document } from "@bedrock/db/schema";
import { InvalidStateError } from "@bedrock/kernel/errors";

import { createCancelHandler } from "../src/commands/cancel";
import { createCreateDraftHandler } from "../src/commands/create-draft";
import { createRepostHandler } from "../src/commands/repost";
import { createUpdateDraftHandler } from "../src/commands/update-draft";
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

  const tx = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => {
          const rows = selectRows.shift() ?? [];
          return {
            limit: vi.fn(async () => rows),
            for: vi.fn(() => ({
              limit: vi.fn(async () => rows),
            })),
          };
        }),
      })),
    })),
    insert: vi.fn((table: unknown) => ({
      values: vi.fn((values: Record<string, unknown>) => {
        if (table === schema.documents) {
          insertedRows.push(values);
          const document = options.insertDocumentResult ?? (values as unknown as Document);
          return {
            onConflictDoNothing: vi.fn(() => ({
              returning: vi.fn(async () => [document]),
            })),
          };
        }

        if (table === schema.documentEvents) {
          eventRows.push(values);
          return undefined;
        }

        return {
          onConflictDoNothing: vi.fn(async () => undefined),
        };
      }),
    })),
    update: vi.fn((table: unknown) => {
      if (table === schema.documents) {
        return {
          set: vi.fn((values: Record<string, unknown>) => ({
            where: vi.fn(() => ({
              returning: vi.fn(async () => [
                options.updateDocumentResult ??
                  buildStoredDocument(values),
              ]),
            })),
          })),
        };
      }

      return {
        set: vi.fn(() => ({
          where: vi.fn(async () => undefined),
        })),
      };
    }),
  };

  const db = {
    transaction: vi.fn(async (fn: (tx: typeof tx) => Promise<unknown>) => fn(tx)),
  };
  const idempotency = {
    withIdempotencyTx: vi.fn(async ({ handler }: { handler: () => Promise<unknown> }) =>
      handler(),
    ),
  };
  const registry = {
    getDocumentModule: vi.fn(() => module),
  };

  return {
    context: {
      accounting: {
        resolvePostingPlan: vi.fn(),
      },
      db,
      idempotency,
      ledger: {
        commit: vi.fn(),
      },
      ledgerReadService: {} as any,
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
      registry,
    },
    tx,
    idempotency,
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

    expect(idempotency.withIdempotencyTx).toHaveBeenCalled();
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

  it("cancels active unposted documents", async () => {
    const document = makeDocument({
      postingStatus: "failed",
    });
    const { context } = createContext({
      document,
      selectRows: [[document]],
    });
    const handler = createCancelHandler(context as any);

    const result = await handler({
      docType: document.docType,
      documentId: document.id,
      actorUserId: "maker-1",
    });

    expect(result.document.lifecycleStatus).toBe("cancelled");
    expect(result.document.cancelledBy).toBe("maker-1");
  });

  it("requeues failed posting operations for repost", async () => {
    const document = makeDocument({
      postingStatus: "failed",
    });
    const { context } = createContext({
      document,
      selectRows: [[document], [{ operationId: "op-1" }]],
    });
    const handler = createRepostHandler(context as any);

    const result = await handler({
      docType: document.docType,
      documentId: document.id,
      actorUserId: "operator-1",
    });

    expect(result.postingOperationId).toBe("op-1");
    expect(result.document.postingStatus).toBe("posting");
  });

  it("rejects repost when there is no posting operation to restart", async () => {
    const document = makeDocument({
      postingStatus: "failed",
    });
    const { context } = createContext({
      document,
      selectRows: [[document], []],
    });
    const handler = createRepostHandler(context as any);

    await expect(
      handler({
        docType: document.docType,
        documentId: document.id,
        actorUserId: "operator-1",
      }),
    ).rejects.toThrow(InvalidStateError);
  });
});
