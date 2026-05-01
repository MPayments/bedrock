import type {
  DocumentDetails as DocumentDetailsResult,
  DocumentWithOperationId,
} from "@bedrock/documents/contracts";
import { toJsonSafe } from "@bedrock/shared/core/json";
import { minorToAmountString } from "@bedrock/shared/money";

import { normalizeMoneyFields } from "../../common/amount";

function restoreRawPayload(
  target: unknown,
  rawPayload: Record<string, unknown>,
) {
  if (!target || typeof target !== "object" || Array.isArray(target)) {
    return;
  }

  (target as { payload: unknown }).payload = toJsonSafe(rawPayload);
}

export function toDocumentDto(input: DocumentWithOperationId) {
  const { document } = input;

  return {
    id: document.id,
    docType: document.docType,
    docNo: document.docNo,
    invoicePurpose:
      document.docType === "invoice" &&
      typeof document.payload.invoicePurpose === "string"
        ? document.payload.invoicePurpose
        : null,
    payloadVersion: document.payloadVersion,
    payload: toJsonSafe(document.payload),
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
    dealId: input.dealId,
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
  };
}

export function queryObjectFromUrl(requestUrl: string) {
  const params = new URL(requestUrl).searchParams;
  const query: Record<string, string | string[]> = {};

  for (const key of new Set(params.keys())) {
    const values = params.getAll(key);
    query[key] = values.length > 1 ? values : (values[0] ?? "");
  }

  return query;
}

export function toDocumentDetailsDto(
  details: DocumentDetailsResult,
  input?: {
    ledgerOperations?: unknown[];
    printForms?: unknown[];
  },
) {
  const normalized = normalizeMoneyFields({
    document: toDocumentDto({
      document: details.document,
      dealId: details.dealId,
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
          dealId: null,
          postingOperationId: null,
          allowedActions: [],
        })
      : null,
    children: details.children.map((document) =>
      toDocumentDto({
        document,
        dealId: null,
        postingOperationId: null,
        allowedActions: [],
      }),
    ),
    dependsOn: details.dependsOn.map((document) =>
      toDocumentDto({
        document,
        dealId: null,
        postingOperationId: null,
        allowedActions: [],
      }),
    ),
    compensates: details.compensates.map((document) =>
      toDocumentDto({
        document,
        dealId: null,
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
          payload: toJsonSafe(details.snapshot.payload),
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
    ledgerOperations: input?.ledgerOperations ?? details.ledgerOperations,
    computed: details.computed,
    extra: details.extra,
  }) as Record<string, unknown>;

  restoreRawPayload(normalized.document, details.document.payload);
  if (input?.printForms && normalized.document && typeof normalized.document === "object") {
    (normalized.document as Record<string, unknown>).printForms = input.printForms;
  }
  restoreRawPayload(normalized.parent, details.parent?.payload ?? {});

  const children = Array.isArray(normalized.children) ? normalized.children : [];
  children.forEach((child, index) => {
    const rawPayload = details.children[index]?.payload;
    if (rawPayload) {
      restoreRawPayload(child, rawPayload);
    }
  });

  const dependsOn = Array.isArray(normalized.dependsOn) ? normalized.dependsOn : [];
  dependsOn.forEach((dependency, index) => {
    const rawPayload = details.dependsOn[index]?.payload;
    if (rawPayload) {
      restoreRawPayload(dependency, rawPayload);
    }
  });

  const compensates = Array.isArray(normalized.compensates)
    ? normalized.compensates
    : [];
  compensates.forEach((document, index) => {
    const rawPayload = details.compensates[index]?.payload;
    if (rawPayload) {
      restoreRawPayload(document, rawPayload);
    }
  });

  if (details.snapshot?.payload) {
    restoreRawPayload(normalized.snapshot, details.snapshot.payload);
  }

  return toJsonSafe(normalized);
}
