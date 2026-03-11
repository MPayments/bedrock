export const IDEMPOTENCY_SCOPE = {
  LEDGER_COMMIT: "ledger.commit",
} as const;

export type IdempotencyScope =
  (typeof IDEMPOTENCY_SCOPE)[keyof typeof IDEMPOTENCY_SCOPE];
