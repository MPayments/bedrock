export const IDEMPOTENCY_SCOPE = {
  BALANCES_RESERVE: "balances.reserve",
  BALANCES_RELEASE: "balances.release",
  BALANCES_CONSUME: "balances.consume",
} as const;

export type IdempotencyScope =
  (typeof IDEMPOTENCY_SCOPE)[keyof typeof IDEMPOTENCY_SCOPE];
