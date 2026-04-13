export const RECONCILIATION_MATCH_STATUSES = [
  "matched",
  "unmatched",
  "ambiguous",
] as const;

export type ReconciliationMatchStatus =
  (typeof RECONCILIATION_MATCH_STATUSES)[number];

export interface MatchResolution {
  status: ReconciliationMatchStatus;
  matchedOperationId: string | null;
  matchedTreasuryOperationId: string | null;
  matchedDocumentId: string | null;
  explanation: Record<string, unknown>;
  exceptionReasonCode?: string;
  exceptionReasonMeta?: Record<string, unknown> | null;
}

export function resolveMatchFromCandidates(input: {
  candidateOperationIds: string[];
  candidateDocumentIds: string[];
  operationId: string | null;
  operationKind: "ledger" | "treasury" | null;
  documentId: string | null;
  matchedOperationId: string | null;
  matchedTreasuryOperationId: string | null;
  matchedDocumentId: string | null;
}): MatchResolution {
  if (
    input.candidateOperationIds.length > 1 ||
    input.candidateDocumentIds.length > 1
  ) {
    return {
      status: "ambiguous",
      matchedOperationId: null,
      matchedTreasuryOperationId: null,
      matchedDocumentId: null,
      explanation: {
        reason: "multiple_candidates",
        candidateOperationIds: input.candidateOperationIds,
        candidateDocumentIds: input.candidateDocumentIds,
      },
      exceptionReasonCode: "ambiguous_match",
      exceptionReasonMeta: {
        candidateOperationIds: input.candidateOperationIds,
        candidateDocumentIds: input.candidateDocumentIds,
      },
    };
  }

  if (
    !input.matchedOperationId &&
    !input.matchedTreasuryOperationId &&
    !input.matchedDocumentId
  ) {
    return {
      status: "unmatched",
      matchedOperationId: null,
      matchedTreasuryOperationId: null,
      matchedDocumentId: null,
      explanation: {
        reason: "no_match",
        operationId: input.operationId,
        operationKind: input.operationKind,
        documentId: input.documentId,
      },
      exceptionReasonCode: "no_match",
      exceptionReasonMeta: {
        operationId: input.operationId,
        operationKind: input.operationKind,
        documentId: input.documentId,
      },
    };
  }

  return {
    status: "matched",
    matchedOperationId: input.matchedOperationId,
    matchedTreasuryOperationId: input.matchedTreasuryOperationId,
    matchedDocumentId: input.matchedDocumentId,
    explanation: {
      reason: "matched_by_reference",
      matchedOperationId: input.matchedOperationId,
      matchedTreasuryOperationId: input.matchedTreasuryOperationId,
      matchedDocumentId: input.matchedDocumentId,
    },
  };
}
