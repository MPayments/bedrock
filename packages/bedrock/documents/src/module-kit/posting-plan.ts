import type { Document } from "@bedrock/documents/schema";
import type {
  DocumentPostingPlan,
  DocumentPostingPlanRequest,
} from "@bedrock/finance/accounting";

export function buildDocumentPostingRequest(
  document: Pick<Document, "occurredAt">,
  input: Omit<DocumentPostingPlanRequest, "bookRefs" | "effectiveAt"> & {
    bookId: string;
  },
): DocumentPostingPlanRequest {
  return {
    templateKey: input.templateKey,
    effectiveAt: document.occurredAt,
    currency: input.currency,
    amountMinor: input.amountMinor,
    bookRefs: {
      bookId: input.bookId,
    },
    dimensions: input.dimensions,
    refs: input.refs ?? null,
    pending: input.pending ?? null,
    memo: input.memo ?? null,
  };
}

export function buildDocumentPostingPlan(input: {
  operationCode: string;
  operationVersion?: number;
  payload: Record<string, unknown>;
  requests: DocumentPostingPlanRequest[];
}): DocumentPostingPlan {
  return {
    operationCode: input.operationCode,
    operationVersion: input.operationVersion ?? 1,
    payload: input.payload,
    requests: input.requests,
  };
}
