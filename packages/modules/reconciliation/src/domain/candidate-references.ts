export interface ReconciliationCandidateReferences {
  candidateOperationIds: string[];
  candidateDocumentIds: string[];
  operationId: string | null;
  operationKind: "ledger" | "treasury" | null;
  documentId: string | null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

export function extractCandidateReferences(
  normalizedPayload: Record<string, unknown>,
): ReconciliationCandidateReferences {
  const candidateOperationIds = readStringArray(
    normalizedPayload.candidateOperationIds,
  );
  const candidateDocumentIds = readStringArray(
    normalizedPayload.candidateDocumentIds,
  );

  return {
    candidateOperationIds,
    candidateDocumentIds,
    operationId: readString(normalizedPayload.operationId),
    operationKind:
      normalizedPayload.operationKind === "ledger" ||
      normalizedPayload.operationKind === "treasury"
        ? normalizedPayload.operationKind
        : null,
    documentId: readString(normalizedPayload.documentId),
  };
}
