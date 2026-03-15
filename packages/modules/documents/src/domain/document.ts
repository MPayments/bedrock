import { Entity, invariant } from "@bedrock/shared/core/domain";

import { buildSummary, type DocumentSummaryFields } from "./document-summary";
import {
  isDocumentActionAllowed,
  type DocumentModuleWorkflowConfig,
} from "./document-workflow";

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

export interface DocumentSnapshot {
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

export type Document = DocumentSnapshot;

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

export interface DocumentPostingSnapshot {
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

export interface CreateDocumentProps {
  id: string;
  docType: string;
  docNoPrefix: string;
  moduleId: string;
  moduleVersion: number;
  payloadVersion: number;
  payload: Record<string, unknown>;
  occurredAt: Date;
  createIdempotencyKey: string;
  createdBy: string;
  approvalStatus: DocumentApprovalStatus;
  postingStatus: DocumentPostingStatus;
  summary: DocumentSummaryFields;
  now: Date;
}

export interface UpdateDocumentDraftProps {
  payload: Record<string, unknown>;
  occurredAt: Date;
  approvalStatus: DocumentApprovalStatus;
  summary: DocumentSummaryFields;
  now: Date;
}

function cloneSnapshot(snapshot: DocumentSnapshot): DocumentSnapshot {
  return {
    ...snapshot,
    payload: { ...snapshot.payload },
  };
}

export function buildDocNo(prefix: string, documentId: string): string {
  return `${prefix}-${documentId.slice(0, 8).toUpperCase()}`;
}

export class DocumentAggregate extends Entity<string> {
  private constructor(private readonly snapshot: DocumentSnapshot) {
    super(snapshot.id);
  }

  static createDraft(input: CreateDocumentProps): DocumentAggregate {
    const summary = buildSummary(input.summary);

    return new DocumentAggregate({
      id: input.id,
      docType: input.docType,
      docNo: buildDocNo(input.docNoPrefix, input.id),
      moduleId: input.moduleId,
      moduleVersion: input.moduleVersion,
      payloadVersion: input.payloadVersion,
      payload: { ...input.payload },
      title: summary.title,
      occurredAt: input.occurredAt,
      submissionStatus: "draft",
      approvalStatus: input.approvalStatus,
      postingStatus: input.postingStatus,
      lifecycleStatus: "active",
      createIdempotencyKey: input.createIdempotencyKey,
      amountMinor: summary.amountMinor,
      currency: summary.currency,
      memo: summary.memo,
      counterpartyId: summary.counterpartyId,
      customerId: summary.customerId,
      organizationRequisiteId: summary.organizationRequisiteId,
      searchText: summary.searchText,
      createdBy: input.createdBy,
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
      createdAt: input.now,
      updatedAt: input.now,
      version: 1,
    });
  }

  static reconstitute(snapshot: DocumentSnapshot): DocumentAggregate {
    return new DocumentAggregate(cloneSnapshot(snapshot));
  }

  toSnapshot(): DocumentSnapshot {
    return cloneSnapshot(this.snapshot);
  }

  updateDraft(input: UpdateDocumentDraftProps): DocumentAggregate {
    invariant(
      this.snapshot.lifecycleStatus === "active" &&
        this.snapshot.submissionStatus === "draft",
      "document.edit_not_allowed",
      "Only active draft documents can be updated",
      { documentId: this.id },
    );

    const summary = buildSummary(input.summary);

    return new DocumentAggregate({
      ...this.snapshot,
      payload: { ...input.payload },
      occurredAt: input.occurredAt,
      approvalStatus: input.approvalStatus,
      title: summary.title,
      amountMinor: summary.amountMinor,
      currency: summary.currency,
      memo: summary.memo,
      counterpartyId: summary.counterpartyId,
      customerId: summary.customerId,
      organizationRequisiteId: summary.organizationRequisiteId,
      searchText: summary.searchText,
      updatedAt: input.now,
    });
  }

  submit(input: {
    actorUserId: string;
    now: Date;
    module: DocumentModuleWorkflowConfig;
  }): DocumentAggregate {
    const canSubmit = isDocumentActionAllowed({
      action: "submit",
      document: this.snapshot,
      module: input.module,
    });

    if (!canSubmit) {
      invariant(
        !(
          input.module.allowDirectPostFromDraft &&
          this.snapshot.submissionStatus === "draft" &&
          this.snapshot.lifecycleStatus === "active"
        ),
        "document.submit_disabled_use_post",
        "Submit action is disabled for this document type; use post",
        { documentId: this.id },
      );
      invariant(
        false,
        "document.submit_not_allowed",
        "Only draft documents can be submitted",
        { documentId: this.id },
      );
    }

    return new DocumentAggregate({
      ...this.snapshot,
      submissionStatus: "submitted",
      submittedBy: input.actorUserId,
      submittedAt: input.now,
      updatedAt: input.now,
    });
  }

  approve(input: {
    actorUserId: string;
    now: Date;
    module: DocumentModuleWorkflowConfig;
  }): DocumentAggregate {
    invariant(
      isDocumentActionAllowed({
        action: "approve",
        document: this.snapshot,
        module: input.module,
      }),
      "document.approve_not_allowed",
      "Document is not awaiting approval",
      { documentId: this.id },
    );

    return new DocumentAggregate({
      ...this.snapshot,
      approvalStatus: "approved",
      approvedBy: input.actorUserId,
      approvedAt: input.now,
      updatedAt: input.now,
    });
  }

  reject(input: {
    actorUserId: string;
    now: Date;
    module: DocumentModuleWorkflowConfig;
  }): DocumentAggregate {
    invariant(
      isDocumentActionAllowed({
        action: "reject",
        document: this.snapshot,
        module: input.module,
      }),
      "document.reject_not_allowed",
      "Document is not awaiting approval",
      { documentId: this.id },
    );

    return new DocumentAggregate({
      ...this.snapshot,
      approvalStatus: "rejected",
      rejectedBy: input.actorUserId,
      rejectedAt: input.now,
      updatedAt: input.now,
    });
  }

  cancel(input: {
    actorUserId: string;
    now: Date;
    module: DocumentModuleWorkflowConfig;
  }): DocumentAggregate {
    invariant(
      isDocumentActionAllowed({
        action: "cancel",
        document: this.snapshot,
        module: input.module,
      }),
      "document.cancel_not_allowed",
      "Only active documents in unposted or failed status can be cancelled",
      { documentId: this.id },
    );

    return new DocumentAggregate({
      ...this.snapshot,
      lifecycleStatus: "cancelled",
      cancelledBy: input.actorUserId,
      cancelledAt: input.now,
      updatedAt: input.now,
    });
  }

  startPosting(input: {
    actorUserId: string;
    now: Date;
    module: DocumentModuleWorkflowConfig;
  }): {
    document: DocumentAggregate;
    submittedImplicitly: boolean;
  } {
    let next: DocumentAggregate = this;
    let submittedImplicitly = false;

    invariant(
      next.snapshot.lifecycleStatus === "active",
      "document.active_required",
      "Only active documents can be posted",
      { documentId: this.id },
    );

    if (
      input.module.allowDirectPostFromDraft &&
      next.snapshot.submissionStatus === "draft"
    ) {
      next = new DocumentAggregate({
        ...next.snapshot,
        submissionStatus: "submitted",
        submittedBy: input.actorUserId,
        submittedAt: input.now,
        updatedAt: input.now,
      });
      submittedImplicitly = true;
    }

    if (
      !isDocumentActionAllowed({
        action: "post",
        document: next.snapshot,
        module: input.module,
      })
    ) {
      invariant(
        input.module.postingRequired &&
          next.snapshot.postingStatus !== "not_required",
        "document.post_not_required",
        "Document does not support posting",
        { documentId: this.id },
      );

      invariant(
        false,
        "document.post_not_ready",
        "Document is not ready for posting",
        { documentId: this.id },
      );
    }

    return {
      document: new DocumentAggregate({
        ...next.snapshot,
        postingStatus: "posting",
        postingStartedAt: input.now,
        postingError: null,
        updatedAt: input.now,
      }),
      submittedImplicitly,
    };
  }

  resetForRepost(input: { now: Date }): DocumentAggregate {
    invariant(
      this.snapshot.lifecycleStatus === "active" &&
        this.snapshot.postingStatus === "failed",
      "document.repost_not_allowed",
      "Only failed documents can be reposted",
      { documentId: this.id },
    );

    return new DocumentAggregate({
      ...this.snapshot,
      postingStatus: "posting",
      postingStartedAt: input.now,
      postingError: null,
      updatedAt: input.now,
    });
  }

  completePosting(input: {
    status: "posted" | "failed";
    now: Date;
    postedAt?: Date | null;
    error?: string | null;
  }): DocumentAggregate {
    invariant(
      this.snapshot.postingStatus === "posting",
      "document.posting_completion_not_allowed",
      "Only posting documents can be finalized",
      { documentId: this.id },
    );

    return new DocumentAggregate({
      ...this.snapshot,
      postingStatus: input.status,
      postedAt:
        input.status === "posted" ? (input.postedAt ?? input.now) : null,
      postingError: input.status === "failed" ? (input.error ?? null) : null,
      updatedAt: input.now,
    });
  }
}

export function assertDocumentIsActive(
  document: Pick<DocumentSnapshot, "id" | "lifecycleStatus">,
  action: string,
) {
  invariant(
    document.lifecycleStatus === "active",
    "document.active_required",
    `Only active documents can be ${action}`,
    { documentId: document.id, action },
  );
}
