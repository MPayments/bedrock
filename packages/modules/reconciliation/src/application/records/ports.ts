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

export interface ReconciliationExternalRecordsTxRepository {
  findBySourceAndSourceRecordId: (input: {
    source: string;
    sourceRecordId: string;
  }) => Promise<ReconciliationExternalRecordRecord | null>;
  create: (
    input: Omit<ReconciliationExternalRecordRecord, "id" | "receivedAt">,
  ) => Promise<ReconciliationExternalRecordRecord>;
  listForRun: (input: {
    source: string;
    externalRecordIds?: string[];
  }) => Promise<ReconciliationExternalRecordRecord[]>;
}
