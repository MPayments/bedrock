import { canonicalJson } from "@bedrock/shared/core/canon";
import { sha256Hex } from "@bedrock/platform/crypto";
import { InvalidStateError } from "@bedrock/shared/core/errors";

import type { Document } from "./types";

export function buildDocNo(prefix: string, documentId: string) {
  return `${prefix}-${documentId.slice(0, 8).toUpperCase()}`;
}

export function assertDocumentIsActive(document: Document, action: string) {
  if (document.lifecycleStatus !== "active") {
    throw new InvalidStateError(
      `Only active documents can be ${action}`,
    );
  }
}

export function buildDefaultActionIdempotencyKey(
  action: string,
  payload: Record<string, unknown>,
) {
  return sha256Hex(canonicalJson({ action, ...payload }));
}

export function toStoredJson<T>(value: T): T {
  return JSON.parse(canonicalJson(value)) as T;
}

export function buildDocumentEventState(document: Document) {
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
