import type { AccountingClosePackage, AccountingPeriodLock } from "../../schema";

export interface AccountingPeriodsRepository {
  findClosedPeriodLock: (input: {
    organizationId: string;
    periodStart: Date;
  }) => Promise<Pick<AccountingPeriodLock, "id"> | null>;
  upsertClosedPeriodLock: (input: {
    organizationId: string;
    periodStart: Date;
    periodEnd: Date;
    closeDocumentId: string;
    closeReason?: string | null;
    closedBy: string;
    closedAt: Date;
  }) => Promise<AccountingPeriodLock>;
  upsertReopenedPeriodLock: (input: {
    organizationId: string;
    periodStart: Date;
    periodEnd: Date;
    reopenedBy: string;
    reopenReason?: string | null;
    reopenedAt: Date;
  }) => Promise<AccountingPeriodLock>;
  findLatestClosePackage: (input: {
    organizationId: string;
    periodStart: Date;
  }) => Promise<Pick<AccountingClosePackage, "id"> | null>;
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
    state: "closed" | "superseded";
    closeDocumentId: string;
    reopenDocumentId?: string | null;
    checksum: string;
    payload: Record<string, unknown>;
  }) => Promise<AccountingClosePackage>;
}
