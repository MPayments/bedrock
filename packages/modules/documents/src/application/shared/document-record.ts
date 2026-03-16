import { randomUUID } from "node:crypto";

import type { Document } from "../../domain/document";
import { buildDocNo } from "../../domain/document";

export function createDocumentInsertBase(params: {
  id?: string;
  docType: string;
  docNoPrefix: string;
  moduleId: string;
  moduleVersion: number;
  payloadVersion: number;
  payload: Record<string, unknown>;
  occurredAt: Date;
  createIdempotencyKey: string;
  createdBy: string;
  approvalStatus: Document["approvalStatus"];
  postingStatus: Document["postingStatus"];
}) {
  const id = params.id ?? randomUUID();
  return {
    id,
    docType: params.docType,
    docNo: buildDocNo(params.docNoPrefix, id),
    moduleId: params.moduleId,
    moduleVersion: params.moduleVersion,
    payloadVersion: params.payloadVersion,
    payload: params.payload,
    title: "",
    occurredAt: params.occurredAt,
    submissionStatus: "draft" as const,
    approvalStatus: params.approvalStatus,
    postingStatus: params.postingStatus,
    lifecycleStatus: "active" as const,
    createIdempotencyKey: params.createIdempotencyKey,
    amountMinor: null,
    currency: null,
    memo: null,
    counterpartyId: null,
    customerId: null,
    organizationRequisiteId: null,
    searchText: "",
    createdBy: params.createdBy,
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
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 1,
  } satisfies Document;
}
