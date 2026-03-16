import { Entity, invariant } from "@bedrock/shared/core/domain";

export type AccountingClosePackageState = "closed" | "superseded";

export interface AccountingClosePackageSnapshot {
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

export type AccountingClosePackageRecord = AccountingClosePackageSnapshot;

export class AccountingClosePackage extends Entity<string> {
  private constructor(
    private readonly snapshot: AccountingClosePackageSnapshot,
  ) {
    super(snapshot.id);
  }

  static fromSnapshot(snapshot: AccountingClosePackageSnapshot) {
    invariant(
      snapshot.organizationId.trim().length > 0,
      "accounting_close_package.organization_required",
      "Accounting close package requires organizationId",
      { organizationId: snapshot.organizationId },
    );

    return new AccountingClosePackage({
      ...snapshot,
      organizationId: snapshot.organizationId.trim(),
      reopenDocumentId: snapshot.reopenDocumentId?.trim() ?? null,
    });
  }

  supersede(reopenDocumentId?: string | null): AccountingClosePackage {
    return new AccountingClosePackage({
      ...this.snapshot,
      state: "superseded",
      reopenDocumentId: reopenDocumentId?.trim() ?? null,
    });
  }

  toSnapshot(): AccountingClosePackageSnapshot {
    return { ...this.snapshot };
  }
}
