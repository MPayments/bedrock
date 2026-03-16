import type { ReconciliationExceptionState } from "../../contracts";
import type { ReconciliationExternalRecordRecord } from "../records/ports";
import type { ReconciliationRunRecord } from "../runs/ports";

export interface ReconciliationExceptionRecord {
  id: string;
  runId: string;
  externalRecordId: string;
  adjustmentDocumentId: string | null;
  reasonCode: string;
  reasonMeta: Record<string, unknown> | null;
  state: ReconciliationExceptionState;
  createdAt: Date;
  resolvedAt: Date | null;
}

export interface ReconciliationExceptionListRow {
  exception: ReconciliationExceptionRecord;
  run: ReconciliationRunRecord;
  externalRecord: ReconciliationExternalRecordRecord;
}

export interface ReconciliationPendingSource {
  source: string;
  externalRecordIds: string[];
  latestReceivedAt: Date;
  pendingRecordCount: number;
}

export interface ReconciliationExceptionsQueryRepository {
  list(input: {
    source?: string;
    state?: ReconciliationExceptionState;
    limit: number;
    offset: number;
  }): Promise<ReconciliationExceptionListRow[]>;
}

export interface ReconciliationExceptionsTxRepository {
  findByIdForUpdate: (id: string) => Promise<ReconciliationExceptionRecord | null>;
  createMany: (
    input: (
      Omit<
        ReconciliationExceptionRecord,
        "id" | "createdAt" | "resolvedAt" | "adjustmentDocumentId"
      >
    )[],
  ) => Promise<void>;
  markResolved: (input: {
    id: string;
    adjustmentDocumentId: string;
    resolvedAt: Date;
  }) => Promise<void>;
}

export interface ReconciliationPendingSourcesPort {
  listPendingSources(batchSize: number): Promise<ReconciliationPendingSource[]>;
}
