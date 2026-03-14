import type {
  AccountingClosePackageRecord,
  AccountingClosePackageState,
  AccountingPeriodLockRecord,
} from "../../domain/periods";

export interface AccountingPeriodsRepository {
  findClosedPeriodLock: (input: {
    organizationId: string;
    periodStart: Date;
  }) => Promise<Pick<AccountingPeriodLockRecord, "id"> | null>;
  upsertClosedPeriodLock: (input: {
    organizationId: string;
    periodStart: Date;
    periodEnd: Date;
    closeDocumentId: string;
    closeReason?: string | null;
    closedBy: string;
    closedAt: Date;
  }) => Promise<AccountingPeriodLockRecord>;
  upsertReopenedPeriodLock: (input: {
    organizationId: string;
    periodStart: Date;
    periodEnd: Date;
    reopenedBy: string;
    reopenReason?: string | null;
    reopenedAt: Date;
  }) => Promise<AccountingPeriodLockRecord>;
  findLatestClosePackage: (input: {
    organizationId: string;
    periodStart: Date;
  }) => Promise<Pick<AccountingClosePackageRecord, "id"> | null>;
  markClosePackageSuperseded: (input: {
    id: string;
    reopenDocumentId?: string | null;
  }) => Promise<void>;
  findMaxClosePackageRevision: (input: {
    organizationId: string;
    periodStart: Date;
  }) => Promise<number>;
  insertClosePackage: (input: {
    organizationId: string;
    periodStart: Date;
    periodEnd: Date;
    revision: number;
    state: AccountingClosePackageState;
    closeDocumentId: string;
    reopenDocumentId?: string | null;
    checksum: string;
    payload: Record<string, unknown>;
  }) => Promise<AccountingClosePackageRecord>;
}

export interface AccountingClosePackageSnapshotPort {
  generateClosePackageSnapshot: (input: {
    organizationId: string;
    periodStart: Date;
    periodEnd: Date;
    closeDocumentId: string;
  }) => Promise<AccountingClosePackageRecord>;
}
