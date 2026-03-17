import { vi } from "vitest";
import { z } from "zod";

import type { IdempotencyPort } from "@bedrock/platform/idempotency";
import type { PersistenceContext } from "@bedrock/platform/persistence";
import { createStubDb } from "@bedrock/test-utils";

import type { Document } from "../src/domain/document";
import type {
  DocumentActionPolicyService,
  DocumentApprovalMode,
  DocumentModule,
  DocumentModuleRuntime,
  DocumentRegistry,
} from "../src/plugins";

const DEFAULT_DOCUMENT_PAYLOAD_SCHEMA = z.object({
  memo: z.string().optional(),
}).passthrough();

export function buildTestDocument(overrides: Partial<Document> = {}): Document {
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
    organizationRequisiteId: "oa-1",
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

export function createTestDocumentModule(
  overrides: Partial<DocumentModule<any, any>> = {},
): DocumentModule<any, any> {
  const createSchema = overrides.createSchema ?? DEFAULT_DOCUMENT_PAYLOAD_SCHEMA;
  const updateSchema = overrides.updateSchema ?? createSchema;
  const payloadSchema = overrides.payloadSchema ?? createSchema;

  return {
    docType: "test_document",
    docNoPrefix: "TST",
    payloadVersion: 1,
    createSchema,
    updateSchema,
    payloadSchema,
    postingRequired: true,
    approvalRequired: () => false,
    async createDraft() {
      return {
        occurredAt: new Date("2026-03-01T00:00:00.000Z"),
        payload: { memo: "draft" },
      };
    },
    async updateDraft() {
      return {
        payload: { memo: "updated" },
      };
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
    async buildDetails() {
      return {
        computed: { label: "computed" },
        extra: { source: "module" },
      };
    },
    buildPostIdempotencyKey() {
      return "post-idem";
    },
    ...overrides,
  };
}

export function createTestDocumentRegistry(
  modules: DocumentModule[],
): DocumentRegistry {
  const byType = new Map<string, DocumentModule>();
  for (const module of modules) {
    if (byType.has(module.docType)) {
      throw new Error(
        `Duplicate document module registration for docType "${module.docType}"`,
      );
    }
    byType.set(module.docType, module);
  }

  return {
    getDocumentModules() {
      return [...byType.values()];
    },
    getDocumentModule(docType: string) {
      const module = byType.get(docType);
      if (!module) {
        throw new Error(`Unknown document module: ${docType}`);
      }

      return module;
    },
  };
}

export function createDocumentPolicyStub(): DocumentActionPolicyService {
  return {
    approvalMode: vi.fn(
      async (): Promise<DocumentApprovalMode> => "not_required",
    ),
    canCreate: vi.fn(async () => ({
      allow: true,
      reasonCode: "allowed",
      reasonMeta: null,
    })),
    canEdit: vi.fn(async () => ({
      allow: true,
      reasonCode: "allowed",
      reasonMeta: null,
    })),
    canSubmit: vi.fn(async () => ({
      allow: true,
      reasonCode: "allowed",
      reasonMeta: null,
    })),
    canApprove: vi.fn(async () => ({
      allow: true,
      reasonCode: "allowed",
      reasonMeta: null,
    })),
    canReject: vi.fn(async () => ({
      allow: true,
      reasonCode: "allowed",
      reasonMeta: null,
    })),
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
}

export function createDocumentsServiceDeps(
  modules: DocumentModule[] = [createTestDocumentModule()],
) {
  const moduleDb = createStubDb();
  const moduleRuntime = createStubDocumentModuleRuntime(moduleDb);
  const repository = {
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
  };
  const ledger = {
    commit: vi.fn(),
  };
  const idempotency = {
    withIdempotency: vi.fn(async ({ handler }: { handler: () => Promise<unknown> }) =>
      handler(),
    ),
  };

  return {
    accounting: {
      getDefaultCompiledPack: vi.fn(),
      loadActiveCompiledPackForBook: vi.fn(),
      resolvePostingPlan: vi.fn(),
    },
    accountingPeriods: {
      assertOrganizationPeriodsOpen: vi.fn(async () => undefined),
      closePeriod: vi.fn(async () => undefined),
      isOrganizationPeriodClosed: vi.fn(async () => false),
      listClosedOrganizationIdsForPeriod: vi.fn(async () => []),
      reopenPeriod: vi.fn(async () => undefined),
    },
    documentEvents: repository,
    documentLinks: repository,
    documentOperations: repository,
    documentSnapshots: repository,
    documentsQuery: repository,
    ledgerReadService: {
      listOperationDetails: vi.fn(async () => new Map()),
      getOperationDetails: vi.fn(),
    },
    moduleRuntime,
    now: () => new Date("2026-03-03T00:00:00.000Z"),
    repository,
    registry: createTestDocumentRegistry(modules),
    transactions: {
      withTransaction: vi.fn(async (run: (context: unknown) => Promise<unknown>) =>
        run({
          documentEvents: repository,
          documentLinks: repository,
          documentOperations: repository,
          documentsCommand: repository,
          moduleRuntime,
          ledger,
          idempotency,
        }),
      ),
    },
  } as any;
}

export function createDocumentsPublicServiceDeps(
  modules: DocumentModule[] = [createTestDocumentModule()],
) {
  const db = createStubDb();
  const persistence: PersistenceContext = {
    db: db as any,
    runInTransaction: async (run) => run(db as any),
  };
  const idempotency: IdempotencyPort = {
    withIdempotencyTx: async ({ handler }) => handler(),
  };

  return {
    accounting: {
      getDefaultCompiledPack: vi.fn(),
      loadActiveCompiledPackForBook: vi.fn(),
      resolvePostingPlan: vi.fn(),
    },
    accountingPeriods: {
      assertOrganizationPeriodsOpen: vi.fn(async () => undefined),
      closePeriod: vi.fn(async () => undefined),
      isOrganizationPeriodClosed: vi.fn(async () => false),
      listClosedOrganizationIdsForPeriod: vi.fn(async () => []),
      reopenPeriod: vi.fn(async () => undefined),
    },
    ledgerReadService: {
      listOperationDetails: vi.fn(async () => new Map()),
      getOperationDetails: vi.fn(),
    },
    persistence,
    idempotency,
    registry: createTestDocumentRegistry(modules),
    now: () => new Date("2026-03-03T00:00:00.000Z"),
  } as const;
}

export function createStubDocumentModuleRuntime(
  queryable: unknown = createStubDb(),
): DocumentModuleRuntime {
  return {
    documents: {
      findIncomingLinkedDocument: vi.fn(async () => null),
      getDocumentByType: vi.fn(async () => null),
      getDocumentOperationId: vi.fn(async () => null),
    },
    withQueryable: (run) => run(queryable),
  };
}
