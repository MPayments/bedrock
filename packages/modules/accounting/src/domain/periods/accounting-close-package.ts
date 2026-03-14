export type AccountingClosePackageState = "closed" | "superseded";

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
