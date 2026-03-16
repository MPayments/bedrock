export const RECONCILIATION_IDEMPOTENCY_SCOPE = {
  INGEST_EXTERNAL_RECORD: "recon.ingestExternalRecord",
  RUN: "recon.run",
  CREATE_ADJUSTMENT_DOCUMENT: "recon.createAdjustmentDocument",
} as const;

export type ReconciliationIdempotencyScope =
  (typeof RECONCILIATION_IDEMPOTENCY_SCOPE)[keyof typeof RECONCILIATION_IDEMPOTENCY_SCOPE];
