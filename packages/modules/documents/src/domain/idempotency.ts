export const DOCUMENTS_IDEMPOTENCY_SCOPE = {
  CREATE_DRAFT: "documents.createDraft",
  UPDATE_DRAFT: "documents.updateDraft",
  SUBMIT: "documents.submit",
  APPROVE: "documents.approve",
  REJECT: "documents.reject",
  POST: "documents.post",
  CANCEL: "documents.cancel",
  REPOST: "documents.repost",
} as const;

export type DocumentsIdempotencyScope =
  (typeof DOCUMENTS_IDEMPOTENCY_SCOPE)[keyof typeof DOCUMENTS_IDEMPOTENCY_SCOPE];
