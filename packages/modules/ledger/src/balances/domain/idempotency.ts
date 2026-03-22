export const BALANCES_IDEMPOTENCY_SCOPE = {
  RESERVE: "balances.reserve",
  RELEASE: "balances.release",
  CONSUME: "balances.consume",
} as const;

export type BalancesIdempotencyScope =
  (typeof BALANCES_IDEMPOTENCY_SCOPE)[keyof typeof BALANCES_IDEMPOTENCY_SCOPE];
