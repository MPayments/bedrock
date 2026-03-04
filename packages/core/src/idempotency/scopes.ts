export const IDEMPOTENCY_SCOPE = {
  DOCUMENTS_CREATE_DRAFT: "documents.createDraft",
  DOCUMENTS_UPDATE_DRAFT: "documents.updateDraft",
  DOCUMENTS_SUBMIT: "documents.submit",
  DOCUMENTS_APPROVE: "documents.approve",
  DOCUMENTS_REJECT: "documents.reject",
  DOCUMENTS_POST: "documents.post",
  DOCUMENTS_CANCEL: "documents.cancel",
  DOCUMENTS_REPOST: "documents.repost",
  LEDGER_COMMIT: "ledger.commit",
  BALANCES_RESERVE: "balances.reserve",
  BALANCES_RELEASE: "balances.release",
  BALANCES_CONSUME: "balances.consume",
  RECON_INGEST_EXTERNAL_RECORD: "recon.ingestExternalRecord",
  RECON_RUN: "recon.run",
  RECON_CREATE_ADJUSTMENT_DOCUMENT: "recon.createAdjustmentDocument",
} as const;

export type IdempotencyScope =
  (typeof IDEMPOTENCY_SCOPE)[keyof typeof IDEMPOTENCY_SCOPE];
