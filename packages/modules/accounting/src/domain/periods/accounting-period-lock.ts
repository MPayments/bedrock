import { Entity, invariant } from "@bedrock/shared/core/domain";

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

function normalizeActor(value: string | null): string | null {
  if (value === null) {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export class AccountingPeriodLock extends Entity<string> {
  private constructor(
    private readonly snapshot: AccountingPeriodLockSnapshot,
  ) {
    super(snapshot.id);
  }

  static fromSnapshot(snapshot: AccountingPeriodLockSnapshot) {
    invariant(
      snapshot.organizationId.trim().length > 0,
      "accounting_period_lock.organization_required",
      "Accounting period lock requires organizationId",
      { organizationId: snapshot.organizationId },
    );

    return new AccountingPeriodLock({
      ...snapshot,
      organizationId: snapshot.organizationId.trim(),
      closeReason: snapshot.closeReason?.trim() ?? null,
      closedBy: normalizeActor(snapshot.closedBy),
      reopenedBy: normalizeActor(snapshot.reopenedBy),
      reopenReason: snapshot.reopenReason?.trim() ?? null,
    });
  }

  isClosed(): boolean {
    return this.snapshot.state === "closed";
  }

  isReopened(): boolean {
    return this.snapshot.state === "reopened";
  }

  toSnapshot(): AccountingPeriodLockSnapshot {
    return { ...this.snapshot };
  }
}
