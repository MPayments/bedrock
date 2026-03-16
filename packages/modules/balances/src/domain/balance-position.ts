import type { BalanceSubject } from "./balance-subject";

export interface BalanceSnapshot extends BalanceSubject {
  ledgerBalance: bigint;
  available: bigint;
  reserved: bigint;
  pending: bigint;
  version: number;
}

export interface BalancePositionDelta {
  deltaAvailable?: bigint;
  deltaReserved?: bigint;
  deltaPending?: bigint;
  deltaLedgerBalance?: bigint;
}

export function createZeroBalanceSnapshot(
  subject: BalanceSubject,
): BalanceSnapshot {
  return {
    ...subject,
    ledgerBalance: 0n,
    available: 0n,
    reserved: 0n,
    pending: 0n,
    version: 1,
  };
}
