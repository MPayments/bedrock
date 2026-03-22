export type BalanceHoldState = "active" | "released" | "consumed";

export interface BalanceHoldRecord {
  id: string;
  holdRef: string;
  amountMinor: bigint;
  state: BalanceHoldState;
  reason: string | null;
  actorId: string | null;
  createdAt: Date;
  releasedAt: Date | null;
  consumedAt: Date | null;
}

export interface BalanceHoldSnapshot {
  id: string;
  holdRef: string;
  amountMinor: bigint;
  state: BalanceHoldState;
  reason: string | null;
  createdAt: Date;
  releasedAt: Date | null;
  consumedAt: Date | null;
}

export interface BalanceHoldUpdate {
  state: BalanceHoldState;
  reason?: string | null;
  actorId?: string | null;
  releasedAt?: Date | null;
  consumedAt?: Date | null;
}

export function toBalanceHoldSnapshot(
  hold: BalanceHoldRecord | null,
): BalanceHoldSnapshot | null {
  if (!hold) {
    return null;
  }

  return {
    id: hold.id,
    holdRef: hold.holdRef,
    amountMinor: hold.amountMinor,
    state: hold.state,
    reason: hold.reason,
    createdAt: hold.createdAt,
    releasedAt: hold.releasedAt,
    consumedAt: hold.consumedAt,
  };
}
