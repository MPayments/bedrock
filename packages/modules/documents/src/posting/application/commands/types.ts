import type { ResolvePostingPlanResult } from "@bedrock/accounting/contracts";

import type { DocumentSnapshot } from "../../../documents/domain/document";
import type { DocumentRequestContext } from "../../../lifecycle/application/contracts/commands";
import type { DocumentActionEvent } from "../../../shared/application/action-runtime";

type PostingPreparationResolution = ResolvePostingPlanResult;

export interface ResolveDocumentPostingIdempotencyKeyInput {
  action: "post" | "repost";
  docType: string;
  documentId: string;
  actorUserId: string;
  idempotencyKey?: string;
}

export interface PreparedDocumentPosting {
  action: "post" | "repost";
  docType: string;
  document: DocumentSnapshot;
  actorUserId: string;
  requestContext?: DocumentRequestContext;
  postingOperationId: string | null;
  successEvents: DocumentActionEvent[];
  finalEvent: {
    eventType: "post" | "repost";
    before: Record<string, unknown> | null;
    after: Record<string, unknown> | null;
    reasonMeta?: Record<string, unknown> | null;
  };
  resolved?: PostingPreparationResolution;
}

export interface FinalizePreparedDocumentPostingInput {
  prepared: PreparedDocumentPosting;
  operationId: string;
}

export interface FinalizeFailedDocumentPostingInput {
  prepared: PreparedDocumentPosting;
  error: string;
  operationId?: string | null;
}
