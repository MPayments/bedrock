import type {
  ReconciliationMatchExplanation,
  ReconciliationMatchStatus,
  ReconciliationRunSummary,
} from "../../contracts";

export interface ReconciliationRunRecord {
  id: string;
  source: string;
  rulesetChecksum: string;
  inputQuery: Record<string, unknown>;
  resultSummary: ReconciliationRunSummary;
  requestId: string | null;
  correlationId: string | null;
  traceId: string | null;
  causationId: string | null;
  createdAt: Date;
}

export interface ReconciliationMatchRecord {
  id: string;
  runId: string;
  externalRecordId: string;
  matchedOperationId: string | null;
  matchedDocumentId: string | null;
  status: ReconciliationMatchStatus;
  explanation: ReconciliationMatchExplanation;
  createdAt: Date;
}

export interface ReconciliationRunsTxRepository {
  findById: (id: string) => Promise<ReconciliationRunRecord | null>;
  create: (
    input: Omit<ReconciliationRunRecord, "id" | "createdAt">,
  ) => Promise<ReconciliationRunRecord>;
}

export interface ReconciliationMatchesQueryRepository {
  findById(id: string): Promise<ReconciliationMatchRecord | null>;
  listByMatchedOperationIds(operationIds: string[]): Promise<ReconciliationMatchRecord[]>;
}

export interface ReconciliationMatchesTxRepository {
  createMany: (
    input: Omit<ReconciliationMatchRecord, "id" | "createdAt">[],
  ) => Promise<void>;
}
