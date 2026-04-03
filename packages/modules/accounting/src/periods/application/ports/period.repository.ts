import type {
  AccountingClosePackageRecord,
  AccountingClosePackageState,
  AccountingPeriodLockRecord,
} from "../../domain";

export interface PeriodRepository {
  upsertClosedPeriodLock(input: {
    organizationId: string;
    periodStart: Date;
    periodEnd: Date;
    closeDocumentId: string;
    closeReason?: string | null;
    closedBy: string;
    closedAt: Date;
  }): Promise<AccountingPeriodLockRecord>;
  upsertReopenedPeriodLock(input: {
    organizationId: string;
    periodStart: Date;
    periodEnd: Date;
    reopenedBy: string;
    reopenReason?: string | null;
    reopenedAt: Date;
  }): Promise<AccountingPeriodLockRecord>;
  findLatestClosePackage(input: {
    organizationId: string;
    periodStart: Date;
  }): Promise<AccountingClosePackageRecord | null>;
  markClosePackageSuperseded(input: {
    id: string;
    reopenDocumentId?: string | null;
  }): Promise<void>;
  findMaxClosePackageRevision(input: {
    organizationId: string;
    periodStart: Date;
  }): Promise<number>;
  insertClosePackage(input: {
    organizationId: string;
    periodStart: Date;
    periodEnd: Date;
    revision: number;
    state: AccountingClosePackageState;
    closeDocumentId: string;
    reopenDocumentId?: string | null;
    checksum: string;
    payload: Record<string, unknown>;
  }): Promise<AccountingClosePackageRecord>;
}
