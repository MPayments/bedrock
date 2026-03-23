import type { AccountingClosePackageRecord } from "../../domain";

export interface ClosePackageSnapshotPort {
  generateClosePackageSnapshot(input: {
    organizationId: string;
    periodStart: Date;
    periodEnd: Date;
    closeDocumentId: string;
  }): Promise<AccountingClosePackageRecord>;
}
