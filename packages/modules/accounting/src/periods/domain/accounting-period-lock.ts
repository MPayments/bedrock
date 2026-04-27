export type AccountingPeriodLockState = "closed" | "reopened";

export interface AccountingPeriodLockSnapshot {
  id: string;
  organizationId: string;
  periodStart: Date;
  periodEnd: Date;
  state: AccountingPeriodLockState;
  lockedByDocumentId: string | null;
  closeReason: string | null;
  closedBy: string | null;
  closedAt: Date | null;
  reopenedBy: string | null;
  reopenReason: string | null;
  reopenedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type AccountingPeriodLockRecord = AccountingPeriodLockSnapshot;
