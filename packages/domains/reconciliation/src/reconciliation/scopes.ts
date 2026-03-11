export const IDEMPOTENCY_SCOPE = {
  RECON_INGEST_EXTERNAL_RECORD: "recon.ingestExternalRecord",
  RECON_RUN: "recon.run",
  RECON_CREATE_ADJUSTMENT_DOCUMENT: "recon.createAdjustmentDocument",
} as const;

export type IdempotencyScope =
  (typeof IDEMPOTENCY_SCOPE)[keyof typeof IDEMPOTENCY_SCOPE];
