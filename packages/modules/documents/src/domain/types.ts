export type DocumentSubmissionStatus = "draft" | "submitted";
export type DocumentApprovalStatus =
  | "not_required"
  | "pending"
  | "approved"
  | "rejected";
export type DocumentPostingStatus =
  | "not_required"
  | "unposted"
  | "posting"
  | "posted"
  | "failed";
export type DocumentLifecycleStatus = "active" | "cancelled";
export type DocumentLinkType =
  | "parent"
  | "depends_on"
  | "compensates"
  | "related";

export interface DocumentInitialLink {
  toDocumentId: string;
  linkType: DocumentLinkType;
  role?: string;
}

export interface Document {
  id: string;
  docType: string;
  docNo: string;
  moduleId: string;
  moduleVersion: number;
  payloadVersion: number;
  payload: Record<string, unknown>;
  title: string;
  occurredAt: Date;
  submissionStatus: DocumentSubmissionStatus;
  approvalStatus: DocumentApprovalStatus;
  postingStatus: DocumentPostingStatus;
  lifecycleStatus: DocumentLifecycleStatus;
  createIdempotencyKey: string | null;
  amountMinor: bigint | null;
  currency: string | null;
  memo: string | null;
  counterpartyId: string | null;
  customerId: string | null;
  organizationRequisiteId: string | null;
  searchText: string;
  createdBy: string;
  submittedBy: string | null;
  submittedAt: Date | null;
  approvedBy: string | null;
  approvedAt: Date | null;
  rejectedBy: string | null;
  rejectedAt: Date | null;
  cancelledBy: string | null;
  cancelledAt: Date | null;
  postingStartedAt: Date | null;
  postedAt: Date | null;
  postingError: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export interface DocumentEvent {
  id: string;
  documentId: string;
  eventType: string;
  actorId: string | null;
  requestId: string | null;
  correlationId: string | null;
  traceId: string | null;
  causationId: string | null;
  reasonCode: string | null;
  reasonMeta: Record<string, unknown> | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  createdAt: Date;
}

export interface DocumentOperation {
  id: string;
  documentId: string;
  operationId: string;
  kind: string;
  createdAt: Date;
}

export interface DocumentLink {
  id: string;
  fromDocumentId: string;
  toDocumentId: string;
  linkType: DocumentLinkType;
  role: string | null;
  createdAt: Date;
}

export interface DocumentSnapshot {
  id: string;
  documentId: string;
  payload: Record<string, unknown>;
  payloadVersion: number;
  moduleId: string;
  moduleVersion: number;
  packChecksum: string;
  postingPlanChecksum: string;
  journalIntentChecksum: string;
  postingPlan: Record<string, unknown>;
  journalIntent: Record<string, unknown>;
  resolvedTemplates: unknown[] | null;
  createdAt: Date;
}
