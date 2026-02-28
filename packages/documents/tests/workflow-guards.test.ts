import { describe, expect, it, vi } from "vitest";

import type { Document } from "@bedrock/db/schema";
import { InvalidStateError } from "@bedrock/kernel/errors";

import { createApproveHandler } from "../src/commands/approve";
import { createPostHandler } from "../src/commands/post";
import { createRejectHandler } from "../src/commands/reject";
import { createSubmitHandler } from "../src/commands/submit";

function makeDocument(overrides: Partial<Document> = {}): Document {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    docType: "test_document",
    docNo: "TST-11111111",
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
    createdAt: new Date("2026-02-28T12:00:00.000Z"),
    updatedAt: new Date("2026-02-28T12:00:00.000Z"),
    version: 1,
    ...overrides,
  };
}

function createSelectChain(document: Document) {
  return {
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        for: vi.fn(() => ({
          limit: vi.fn(async () => [document]),
        })),
      })),
    })),
  };
}

function createModuleStub() {
  return {
    canSubmit: vi.fn(),
    canApprove: vi.fn(),
    canReject: vi.fn(),
    canPost: vi.fn(),
    postingRequired: true,
    buildIntent: vi.fn(),
    buildPostIdempotencyKey: vi.fn(() => "post-idem"),
  };
}

function createContext(document: Document, module: ReturnType<typeof createModuleStub>) {
  const tx = {
    select: vi.fn(() => createSelectChain(document)),
    update: vi.fn(),
    insert: vi.fn(),
  };
  const db = {
    transaction: vi.fn(async (callback: (value: typeof tx) => Promise<unknown>) =>
      callback(tx),
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
      db,
      ledger,
      ledgerReadService: {} as any,
      registry,
      log: {} as any,
    },
    tx,
    ledger,
  };
}

describe("documents workflow lifecycle guards", () => {
  it.each([
    {
      name: "submit",
      build: createSubmitHandler,
      document: makeDocument({ lifecycleStatus: "cancelled", submissionStatus: "draft" }),
      moduleMethod: "canSubmit",
    },
    {
      name: "approve",
      build: createApproveHandler,
      document: makeDocument({
        lifecycleStatus: "cancelled",
        submissionStatus: "submitted",
        approvalStatus: "pending",
      }),
      moduleMethod: "canApprove",
    },
    {
      name: "reject",
      build: createRejectHandler,
      document: makeDocument({
        lifecycleStatus: "cancelled",
        submissionStatus: "submitted",
        approvalStatus: "pending",
      }),
      moduleMethod: "canReject",
    },
    {
      name: "post",
      build: createPostHandler,
      document: makeDocument({
        lifecycleStatus: "cancelled",
        submissionStatus: "submitted",
        approvalStatus: "approved",
        postingStatus: "unposted",
      }),
      moduleMethod: "canPost",
    },
  ])("prevents $name on cancelled documents", async ({ build, document, moduleMethod }) => {
    const module = createModuleStub();
    const { context, tx, ledger } = createContext(document, module);
    const handler = build(context as any);

    await expect(
      handler({
        docType: document.docType,
        documentId: document.id,
        actorUserId: "checker-1",
      }),
    ).rejects.toThrow(InvalidStateError);

    expect(module[moduleMethod as keyof typeof module]).not.toHaveBeenCalled();
    expect(tx.update).not.toHaveBeenCalled();
    expect(ledger.commit).not.toHaveBeenCalled();
  });
});
