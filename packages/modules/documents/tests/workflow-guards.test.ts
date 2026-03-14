import { describe, expect, it, vi } from "vitest";

import { InvalidStateError } from "@bedrock/shared/core/errors";

import { createTransitionHandler } from "../src/application/commands/transition";
import type { Document } from "../src/domain/types";

function makeDocument(overrides: Partial<Document> = {}): Document {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    docType: "test_document",
    docNo: "TST-11111111",
    moduleId: "test_document",
    moduleVersion: 1,
    payloadVersion: 1,
    payload: {},
    title: "Test document",
    occurredAt: new Date("2026-02-28T12:00:00.000Z"),
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
    createdAt: new Date("2026-02-28T12:00:00.000Z"),
    updatedAt: new Date("2026-02-28T12:00:00.000Z"),
    version: 1,
    ...overrides,
  };
}

function createModuleStub() {
  return {
    canSubmit: vi.fn(),
    canApprove: vi.fn(),
    canReject: vi.fn(),
    canPost: vi.fn(),
    postingRequired: true,
    buildPostingPlan: vi.fn(),
    buildPostIdempotencyKey: vi.fn(() => "post-idem"),
  };
}

function createContext(document: Document, module: ReturnType<typeof createModuleStub>) {
  const repository = {
    findDocumentByType: vi.fn(async () => document),
    findDocumentWithPostingOperation: vi.fn(),
    findDocumentByCreateIdempotencyKey: vi.fn(),
    findPostingOperationId: vi.fn(async () => null),
    insertDocument: vi.fn(),
    updateDocument: vi.fn(),
    insertDocumentOperation: vi.fn(),
    resetPostingOperation: vi.fn(),
    insertDocumentEvent: vi.fn(),
    insertInitialLinks: vi.fn(),
    listDocuments: vi.fn(),
    listDocumentLinks: vi.fn(),
    listDocumentsByIds: vi.fn(),
    listDocumentOperations: vi.fn(),
    listDocumentEvents: vi.fn(),
    findDocumentSnapshot: vi.fn(),
    getLatestPostingArtifacts: vi.fn(),
  };
  const ledger = {
    commit: vi.fn(),
  };
  const accounting = {
    resolvePostingPlan: vi.fn(),
  };
  const registry = {
    getDocumentModule: vi.fn(() => module),
  };
  const idempotency = {
    withIdempotency: vi.fn(async ({ handler }: { handler: () => Promise<unknown> }) =>
      handler(),
    ),
  };

  return {
    context: {
      accounting,
      accountingPeriods: {
        assertOrganizationPeriodsOpen: vi.fn(async () => undefined),
      },
      ledgerReadService: {} as any,
      moduleDb: {} as any,
      policy: undefined,
      registry,
      repository,
      transactions: {
        withTransaction: vi.fn(async (run: (context: unknown) => Promise<unknown>) =>
          run({
            idempotency,
            ledger,
            moduleDb: {} as any,
            repository,
          }),
        ),
      },
      log: {} as any,
    },
    repository,
    accounting,
    ledger,
    idempotency,
  };
}

describe("documents workflow lifecycle guards", () => {
  it.each([
    {
      name: "submit",
      action: "submit",
      document: makeDocument({ lifecycleStatus: "cancelled", submissionStatus: "draft" }),
      moduleMethod: "canSubmit",
    },
    {
      name: "approve",
      action: "approve",
      document: makeDocument({
        lifecycleStatus: "cancelled",
        submissionStatus: "submitted",
        approvalStatus: "pending",
      }),
      moduleMethod: "canApprove",
    },
    {
      name: "reject",
      action: "reject",
      document: makeDocument({
        lifecycleStatus: "cancelled",
        submissionStatus: "submitted",
        approvalStatus: "pending",
      }),
      moduleMethod: "canReject",
    },
    {
      name: "post",
      action: "post",
      document: makeDocument({
        lifecycleStatus: "cancelled",
        submissionStatus: "submitted",
        approvalStatus: "approved",
        postingStatus: "unposted",
      }),
      moduleMethod: "canPost",
    },
  ])("prevents $name on cancelled documents", async ({ action, document, moduleMethod }) => {
    const module = createModuleStub();
    const { context, ledger, repository } = createContext(document, module);
    const transition = createTransitionHandler(context as any);

    await expect(
      transition({
        action,
        docType: document.docType,
        documentId: document.id,
        actorUserId: "checker-1",
      }),
    ).rejects.toThrow(InvalidStateError);

    expect(module[moduleMethod as keyof typeof module]).not.toHaveBeenCalled();
    expect(repository.updateDocument).not.toHaveBeenCalled();
    expect(ledger.commit).not.toHaveBeenCalled();
  });

  it("blocks explicit submit for modules that require direct post from draft", async () => {
    const document = makeDocument({
      lifecycleStatus: "active",
      submissionStatus: "draft",
      postingStatus: "unposted",
    });
    const module = {
      ...createModuleStub(),
      allowDirectPostFromDraft: true,
    };
    const { context, repository } = createContext(document, module);
    const transition = createTransitionHandler(context as any);

    await expect(
      transition({
        action: "submit",
        docType: document.docType,
        documentId: document.id,
        actorUserId: "maker-1",
      }),
    ).rejects.toThrow("Submit action is disabled for this document type; use post");

    expect(module.canSubmit).not.toHaveBeenCalled();
    expect(repository.updateDocument).not.toHaveBeenCalled();
  });
});
