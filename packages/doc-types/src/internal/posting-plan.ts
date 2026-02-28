import type {
  DocumentPostingPlan,
  DocumentPostingPlanRequest,
} from "@bedrock/accounting";
import type { Document } from "@bedrock/db/schema";
import { SYSTEM_LEDGER_ORG_ID } from "@bedrock/kernel/constants";

export function buildDocumentPostingRequest(
  document: Pick<Document, "occurredAt">,
  input: Omit<DocumentPostingPlanRequest, "bookRefs" | "effectiveAt"> & {
    bookOrgId?: string;
  },
): DocumentPostingPlanRequest {
  return {
    templateKey: input.templateKey,
    effectiveAt: document.occurredAt,
    currency: input.currency,
    amountMinor: input.amountMinor,
    bookRefs: {
      bookOrgId: input.bookOrgId ?? SYSTEM_LEDGER_ORG_ID,
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
