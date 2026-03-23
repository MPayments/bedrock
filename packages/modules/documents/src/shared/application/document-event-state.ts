import type { DocumentSnapshot } from "../../documents/domain/document";

export function buildDocumentEventState(document: DocumentSnapshot) {
  return {
    id: document.id,
    docType: document.docType,
    docNo: document.docNo,
    moduleId: document.moduleId,
    moduleVersion: document.moduleVersion,
    payloadVersion: document.payloadVersion,
    title: document.title,
    occurredAt: document.occurredAt,
    submissionStatus: document.submissionStatus,
    approvalStatus: document.approvalStatus,
    postingStatus: document.postingStatus,
    lifecycleStatus: document.lifecycleStatus,
    amountMinor: document.amountMinor,
    currency: document.currency,
    memo: document.memo,
    version: document.version,
    postingError: document.postingError,
    postingStartedAt: document.postingStartedAt,
    postedAt: document.postedAt,
    updatedAt: document.updatedAt,
  };
}
