export const IDEMPOTENCY_SCOPE = {
  DOCUMENTS_CREATE_DRAFT: "documents.createDraft",
  DOCUMENTS_UPDATE_DRAFT: "documents.updateDraft",
  DOCUMENTS_SUBMIT: "documents.submit",
  DOCUMENTS_APPROVE: "documents.approve",
  DOCUMENTS_REJECT: "documents.reject",
  DOCUMENTS_POST: "documents.post",
  DOCUMENTS_CANCEL: "documents.cancel",
  DOCUMENTS_REPOST: "documents.repost",
} as const;

export type IdempotencyScope =
  (typeof IDEMPOTENCY_SCOPE)[keyof typeof IDEMPOTENCY_SCOPE];
