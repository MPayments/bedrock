import { describe, expect, it, vi } from "vitest";

import { InvalidStateError } from "@bedrock/shared/core/errors";

import type { DocumentSnapshot } from "../src/documents/domain/document";
import { ExecuteDocumentTransitionCommand } from "../src/lifecycle/application/commands/transition";

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
    docType: "test_document",
    moduleVersion: 1,
    canSubmit: vi.fn(),
    canApprove: vi.fn(),
    canReject: vi.fn(),
    canPost: vi.fn(),
    postingRequired: true,
    approvalRequired: vi.fn(() => false),
    buildPostingPlan: vi.fn(),
    buildPostIdempotencyKey: vi.fn(() => "post-idem"),
  };
}

function createContext(
  document: DocumentSnapshot,
  module: ReturnType<typeof createModuleStub>,
) {
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
  const accounting = {
    resolvePostingPlan: vi.fn(),
  };
  const moduleRuntime = {
    documents: {
      findIncomingLinkedDocument: vi.fn(async () => null),
      listIncomingLinkedDocuments: vi.fn(async () => []),
      getDocumentByType: vi.fn(async () => null),
      getDocumentOperationId: vi.fn(async () => null),
    },
  };
  const registry = {
    getDocumentModule: vi.fn(() => module),
    getDocumentModules: vi.fn(() => [module]),
  };
  const idempotency = {
    withIdempotency: vi.fn(async ({ handler }: { handler: () => Promise<unknown> }) =>
      handler(),
    ),
  };
  const runtime = {
    generateUuid: vi.fn(
      () => "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    ),
    now: () => new Date("2026-03-03T00:00:00.000Z"),
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
        documentOperations: repository,
        idempotency,
        moduleRuntime,
      }),
    ),
  };
  const policy = {
    canCreate: vi.fn(async () => ({ allow: true, reasonCode: "allowed", reasonMeta: null })),
    canEdit: vi.fn(async () => ({ allow: true, reasonCode: "allowed", reasonMeta: null })),
    canSubmit: vi.fn(async () => ({ allow: true, reasonCode: "allowed", reasonMeta: null })),
    canApprove: vi.fn(async () => ({ allow: true, reasonCode: "allowed", reasonMeta: null })),
    canReject: vi.fn(async () => ({ allow: true, reasonCode: "allowed", reasonMeta: null })),
    canPost: vi.fn(async () => ({ allow: true, reasonCode: "allowed", reasonMeta: null })),
    canCancel: vi.fn(async () => ({ allow: true, reasonCode: "allowed", reasonMeta: null })),
    approvalMode: vi.fn(),
  };

  return {
    lifecycleDeps: {
      runtime,
      commandUow,
      accountingPeriods: {
        assertOrganizationPeriodsOpen: vi.fn(async () => undefined),
        closePeriod: vi.fn(async () => undefined),
        isOrganizationPeriodClosed: vi.fn(async () => false),
        listClosedOrganizationIdsForPeriod: vi.fn(async () => []),
        reopenPeriod: vi.fn(async () => undefined),
      },
      registry,
      policy,
      transitionEffects: {
        apply: vi.fn(async () => undefined),
      },
    },
    repository,
    accounting,
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
  ])("prevents $name on cancelled documents", async ({ action, document, moduleMethod }) => {
    const module = createModuleStub();
    const { lifecycleDeps, repository } = createContext(document, module);
    const transition = new ExecuteDocumentTransitionCommand(
      lifecycleDeps as any,
    );

    await expect(
      transition.execute({
        action,
        docType: document.docType,
        documentId: document.id,
        actorUserId: "checker-1",
      }),
    ).rejects.toThrow(InvalidStateError);

    expect(module[moduleMethod as keyof typeof module]).not.toHaveBeenCalled();
    expect(repository.updateDocument).not.toHaveBeenCalled();
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
    const { lifecycleDeps, repository } = createContext(document, module);
    const transition = new ExecuteDocumentTransitionCommand(
      lifecycleDeps as any,
    );

    await expect(
      transition.execute({
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
