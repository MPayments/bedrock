import { z } from "zod";

import type { DocumentModule } from "@bedrock/documents";
import { type Document } from "@bedrock/documents/schema";

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
