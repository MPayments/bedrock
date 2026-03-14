export type AccountingPeriodLockState = "closed" | "reopened";
export type AccountingClosePackageState = "closed" | "superseded";

export interface AccountingPeriodLockRecord {
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

export interface AccountingClosePackageRecord {
  id: string;
  organizationId: string;
  periodStart: Date;
  periodEnd: Date;
  revision: number;
  state: AccountingClosePackageState;
  closeDocumentId: string;
  reopenDocumentId: string | null;
  checksum: string;
  payload: Record<string, unknown>;
  generatedAt: Date;
  createdAt: Date;
}
