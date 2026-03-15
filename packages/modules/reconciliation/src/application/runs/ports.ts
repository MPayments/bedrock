import type { Transaction } from "@bedrock/platform/persistence";

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

export interface ReconciliationRunsRepository {
  findByIdTx(tx: Transaction, id: string): Promise<ReconciliationRunRecord | null>;
  createTx(
    tx: Transaction,
    input: Omit<ReconciliationRunRecord, "id" | "createdAt">,
  ): Promise<ReconciliationRunRecord>;
}

export interface ReconciliationMatchesRepository {
  findById(id: string): Promise<ReconciliationMatchRecord | null>;
  createManyTx(
    tx: Transaction,
    input: Omit<ReconciliationMatchRecord, "id" | "createdAt">[],
  ): Promise<void>;
}
