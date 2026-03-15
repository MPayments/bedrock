import type { Queryable } from "@bedrock/platform/persistence";

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

export interface ReconciliationExceptionsRepository {
  findByIdForUpdate(
    executor: Queryable,
    id: string,
  ): Promise<ReconciliationExceptionRecord | null>;
  createMany(
    executor: Queryable,
    input: (
      Omit<
        ReconciliationExceptionRecord,
        "id" | "createdAt" | "resolvedAt" | "adjustmentDocumentId"
      >
    )[],
  ): Promise<void>;
  list(
    executor: Queryable,
    input: {
      source?: string;
      state?: ReconciliationExceptionState;
      limit: number;
      offset: number;
    },
  ): Promise<ReconciliationExceptionListRow[]>;
  markResolved(
    executor: Queryable,
    input: {
      id: string;
      adjustmentDocumentId: string;
      resolvedAt: Date;
    },
  ): Promise<void>;
}

export interface ReconciliationPendingSourcesPort {
  listPendingSources(batchSize: number): Promise<ReconciliationPendingSource[]>;
}
