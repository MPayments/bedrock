import { createPaginatedListSchema } from "@multihansa/common/pagination";
import type {
  DocumentDetails as DocumentDetailsResult,
  DocumentWithOperationId,
} from "@multihansa/documents/runtime";
import { z } from "zod";

import { minorToAmountString, normalizeMoneyFields } from "@multihansa/common/bedrock";
import { toJsonSafe } from "@multihansa/common/bedrock";

export const DocumentSchema = z.object({
  id: z.uuid(),
  docType: z.string(),
  docNo: z.string(),
  payloadVersion: z.number().int(),
  payload: z.record(z.string(), z.unknown()),
  title: z.string(),
  occurredAt: z.iso.datetime(),
  submissionStatus: z.enum(["draft", "submitted"]),
  approvalStatus: z.enum(["not_required", "pending", "approved", "rejected"]),
  postingStatus: z.enum([
    "not_required",
    "unposted",
    "posting",
    "posted",
    "failed",
  ]),
  lifecycleStatus: z.enum(["active", "cancelled"]),
  allowedActions: z.array(
    z.enum(["edit", "submit", "approve", "reject", "post", "cancel", "repost"]),
  ),
  createIdempotencyKey: z.string().nullable(),
  amount: z.string().nullable(),
  currency: z.string().nullable(),
  memo: z.string().nullable(),
  counterpartyId: z.string().nullable(),
  customerId: z.string().nullable(),
  organizationRequisiteId: z.string().nullable(),
  searchText: z.string(),
  createdBy: z.string(),
  submittedBy: z.string().nullable(),
  submittedAt: z.iso.datetime().nullable(),
  approvedBy: z.string().nullable(),
  approvedAt: z.iso.datetime().nullable(),
  rejectedBy: z.string().nullable(),
  rejectedAt: z.iso.datetime().nullable(),
  cancelledBy: z.string().nullable(),
  cancelledAt: z.iso.datetime().nullable(),
  postingStartedAt: z.iso.datetime().nullable(),
  postedAt: z.iso.datetime().nullable(),
  postingError: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  version: z.number().int(),
  postingOperationId: z.string().nullable(),
});

const DocumentLinkSchema = z.object({
  id: z.uuid(),
  fromDocumentId: z.uuid(),
  toDocumentId: z.uuid(),
  linkType: z.enum(["parent", "depends_on", "compensates", "related"]),
  role: z.string().nullable(),
  createdAt: z.iso.datetime(),
});

const DocumentOperationSchema = z.object({
  id: z.uuid(),
  documentId: z.uuid(),
  operationId: z.uuid(),
  kind: z.string(),
  createdAt: z.iso.datetime(),
});

export const DocumentsListResponseSchema = createPaginatedListSchema(DocumentSchema);

export const DocumentDetailsSchema = z.object({
  document: DocumentSchema,
  links: z.array(DocumentLinkSchema),
  parent: DocumentSchema.nullable(),
  children: z.array(DocumentSchema),
  dependsOn: z.array(DocumentSchema),
  compensates: z.array(DocumentSchema),
  documentOperations: z.array(DocumentOperationSchema),
  ledgerOperations: z.array(z.unknown()),
  computed: z.unknown().optional(),
  extra: z.unknown().optional(),
});

export const OperationSummarySchema = z.object({
  id: z.uuid(),
  sourceType: z.string(),
  sourceId: z.string(),
  operationCode: z.string(),
  operationVersion: z.number().int(),
  postingDate: z.iso.datetime(),
  status: z.enum(["pending", "posted", "failed"]),
  error: z.string().nullable(),
  postedAt: z.iso.datetime().nullable(),
  outboxAttempts: z.number().int(),
  lastOutboxErrorAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  postingCount: z.number().int(),
  bookIds: z.array(z.string()),
  currencies: z.array(z.string()),
});

const OperationPostingSchema = z.object({
  id: z.uuid(),
  lineNo: z.number().int(),
  bookId: z.uuid(),
  bookName: z.string().nullable(),
  debitInstanceId: z.uuid(),
  debitAccountNo: z.string().nullable(),
  debitDimensions: z.record(z.string(), z.string()).nullable(),
  creditInstanceId: z.uuid(),
  creditAccountNo: z.string().nullable(),
  creditDimensions: z.record(z.string(), z.string()).nullable(),
  postingCode: z.string(),
  currency: z.string(),
  currencyPrecision: z.number().int(),
  amount: z.string(),
  memo: z.string().nullable(),
  context: z.record(z.string(), z.string()).nullable(),
  createdAt: z.iso.datetime(),
});

const OperationTbPlanSchema = z.object({
  id: z.uuid(),
  lineNo: z.number().int(),
  type: z.enum(["create", "post_pending", "void_pending"]),
  transferId: z.string(),
  debitTbAccountId: z.string().nullable(),
  creditTbAccountId: z.string().nullable(),
  tbLedger: z.number().int(),
  amount: z.string(),
  code: z.number().int(),
  pendingRef: z.string().nullable(),
  pendingId: z.string().nullable(),
  isLinked: z.boolean(),
  isPending: z.boolean(),
  timeoutSeconds: z.number().int(),
  status: z.enum(["pending", "posted", "failed"]),
  error: z.string().nullable(),
  createdAt: z.iso.datetime(),
});

export const OperationsListResponseSchema = createPaginatedListSchema(
  OperationSummarySchema,
);

export const OperationDetailsSchema = z.object({
  operation: OperationSummarySchema,
  postings: z.array(OperationPostingSchema),
  tbPlans: z.array(OperationTbPlanSchema),
  dimensionLabels: z.record(z.string(), z.string()),
});

export function toDocumentDto(input: DocumentWithOperationId) {
  const { document } = input;

  return DocumentSchema.parse({
    id: document.id,
    docType: document.docType,
    docNo: document.docNo,
    payloadVersion: document.payloadVersion,
    payload: z
      .record(z.string(), z.unknown())
      .parse(toJsonSafe(normalizeMoneyFields(document.payload))),
    title: document.title,
    occurredAt: document.occurredAt.toISOString(),
    submissionStatus: document.submissionStatus,
    approvalStatus: document.approvalStatus,
    postingStatus: document.postingStatus,
    lifecycleStatus: document.lifecycleStatus,
    createIdempotencyKey: document.createIdempotencyKey,
    amount:
      document.amountMinor == null
        ? null
        : minorToAmountString(document.amountMinor, {
            currency: document.currency,
          }),
    currency: document.currency,
    memo: document.memo,
    counterpartyId: document.counterpartyId,
    customerId: document.customerId,
    organizationRequisiteId: document.organizationRequisiteId,
    searchText: document.searchText,
    createdBy: document.createdBy,
    submittedBy: document.submittedBy,
    submittedAt: document.submittedAt?.toISOString() ?? null,
    approvedBy: document.approvedBy,
    approvedAt: document.approvedAt?.toISOString() ?? null,
    rejectedBy: document.rejectedBy,
    rejectedAt: document.rejectedAt?.toISOString() ?? null,
    cancelledBy: document.cancelledBy,
    cancelledAt: document.cancelledAt?.toISOString() ?? null,
    postingStartedAt: document.postingStartedAt?.toISOString() ?? null,
    postedAt: document.postedAt?.toISOString() ?? null,
    postingError: document.postingError,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
    version: document.version,
    postingOperationId: input.postingOperationId,
    allowedActions: input.allowedActions,
  });
}

export function toDocumentDetailsDto(details: DocumentDetailsResult) {
  return toJsonSafe(
    normalizeMoneyFields({
      document: toDocumentDto({
        document: details.document,
        postingOperationId: details.postingOperationId,
        allowedActions: details.allowedActions,
      }),
      links: details.links.map((link) => ({
        id: link.id,
        fromDocumentId: link.fromDocumentId,
        toDocumentId: link.toDocumentId,
        linkType: link.linkType,
        role: link.role,
        createdAt: link.createdAt.toISOString(),
      })),
      parent: details.parent
        ? toDocumentDto({
            document: details.parent,
            postingOperationId: null,
            allowedActions: [],
          })
        : null,
      children: details.children.map((document) =>
        toDocumentDto({
          document,
          postingOperationId: null,
          allowedActions: [],
        }),
      ),
      dependsOn: details.dependsOn.map((document) =>
        toDocumentDto({
          document,
          postingOperationId: null,
          allowedActions: [],
        }),
      ),
      compensates: details.compensates.map((document) =>
        toDocumentDto({
          document,
          postingOperationId: null,
          allowedActions: [],
        }),
      ),
      documentOperations: details.documentOperations.map((operation) => ({
        id: operation.id,
        documentId: operation.documentId,
        operationId: operation.operationId,
        kind: operation.kind,
        createdAt: operation.createdAt.toISOString(),
      })),
      events: details.events.map((event) => ({
        id: event.id,
        documentId: event.documentId,
        eventType: event.eventType,
        actorId: event.actorId,
        requestId: event.requestId,
        correlationId: event.correlationId,
        traceId: event.traceId,
        causationId: event.causationId,
        reasonCode: event.reasonCode,
        reasonMeta: event.reasonMeta,
        before: event.before,
        after: event.after,
        createdAt: event.createdAt.toISOString(),
      })),
      snapshot: details.snapshot
        ? {
            id: details.snapshot.id,
            documentId: details.snapshot.documentId,
            payload: details.snapshot.payload,
            payloadVersion: details.snapshot.payloadVersion,
            moduleId: details.snapshot.moduleId,
            moduleVersion: details.snapshot.moduleVersion,
            packChecksum: details.snapshot.packChecksum,
            postingPlanChecksum: details.snapshot.postingPlanChecksum,
            journalIntentChecksum: details.snapshot.journalIntentChecksum,
            postingPlan: details.snapshot.postingPlan,
            journalIntent: details.snapshot.journalIntent,
            resolvedTemplates: details.snapshot.resolvedTemplates,
            createdAt: details.snapshot.createdAt.toISOString(),
          }
        : null,
      ledgerOperations: details.ledgerOperations,
      computed: details.computed,
      extra: details.extra,
    }),
  );
}
