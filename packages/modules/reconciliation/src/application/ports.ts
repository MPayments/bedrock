import type { DocumentWithOperationId } from "@bedrock/documents/contracts";
import type { IdempotencyPort } from "@bedrock/platform/idempotency";
import type { Queryable } from "@bedrock/platform/persistence";
import type { CorrelationContext } from "@bedrock/shared/core/correlation";

import type {
  ReconciliationExceptionState,
  ReconciliationMatchExplanation,
  ReconciliationMatchStatus,
  ReconciliationRunSummary,
} from "../contracts";

export interface ReconciliationDocumentsPort {
  createDraft(input: {
    docType: string;
    createIdempotencyKey: string;
    payload: unknown;
    actorUserId: string;
    requestContext?: CorrelationContext;
  }): Promise<DocumentWithOperationId>;
  existsById(documentId: string): Promise<boolean>;
}

export interface ReconciliationLedgerLookupPort {
  operationExists(operationId: string): Promise<boolean>;
}

export type ReconciliationIdempotencyPort = IdempotencyPort;

export interface ReconciliationExternalRecordRecord {
  id: string;
  source: string;
  sourceRecordId: string;
  rawPayload: Record<string, unknown>;
  normalizedPayload: Record<string, unknown>;
  payloadHash: string;
  normalizationVersion: number;
  requestId: string | null;
  correlationId: string | null;
  traceId: string | null;
  causationId: string | null;
  receivedAt: Date;
}

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

export interface ReconciliationExternalRecordsRepositoryPort {
  findBySourceAndSourceRecordId(
    executor: Queryable,
    input: { source: string; sourceRecordId: string },
  ): Promise<ReconciliationExternalRecordRecord | null>;
  create(
    executor: Queryable,
    input: Omit<ReconciliationExternalRecordRecord, "id" | "receivedAt">,
  ): Promise<ReconciliationExternalRecordRecord>;
  listForRun(
    executor: Queryable,
    input: { source: string; externalRecordIds?: string[] },
  ): Promise<ReconciliationExternalRecordRecord[]>;
}

export interface ReconciliationRunsRepositoryPort {
  findById(
    executor: Queryable,
    id: string,
  ): Promise<ReconciliationRunRecord | null>;
  create(
    executor: Queryable,
    input: Omit<ReconciliationRunRecord, "id" | "createdAt">,
  ): Promise<ReconciliationRunRecord>;
}

export interface ReconciliationMatchesRepositoryPort {
  findById(
    executor: Queryable,
    id: string,
  ): Promise<ReconciliationMatchRecord | null>;
  createMany(
    executor: Queryable,
    input: (
      Omit<ReconciliationMatchRecord, "id" | "createdAt">
    )[],
  ): Promise<void>;
}

export interface ReconciliationExceptionsRepositoryPort {
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
