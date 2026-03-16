import { AggregateRoot, invariant } from "@bedrock/shared/core/domain";

import {
  AccountingClosePackage,
  type AccountingClosePackageSnapshot,
} from "./accounting-close-package";
import { type AccountingPeriodLockSnapshot } from "./accounting-period-lock";
import type { CalendarMonth } from "./calendar-month";

export interface AccountingPeriodSnapshot {
  organizationId: string;
  month: CalendarMonth;
  lock: AccountingPeriodLockSnapshot | null;
  latestClosePackage: AccountingClosePackageSnapshot | null;
}

export interface CloseAccountingPeriodInput {
  closeDocumentId: string;
  closeReason?: string | null;
  closedBy: string;
  closedAt: Date;
}

export interface ReopenAccountingPeriodInput {
  reopenedBy: string;
  reopenReason?: string | null;
  reopenedAt: Date;
  reopenDocumentId?: string | null;
}

export class AccountingPeriod extends AggregateRoot<string> {
  private constructor(
    private readonly snapshot: AccountingPeriodSnapshot,
  ) {
    super(`${snapshot.organizationId}:${snapshot.month.label}`);
  }

  static fromSnapshot(snapshot: AccountingPeriodSnapshot) {
    invariant(
      snapshot.organizationId.trim().length > 0,
      "accounting_period.organization_required",
      "Accounting period requires organizationId",
      { organizationId: snapshot.organizationId },
    );

    return new AccountingPeriod({
      ...snapshot,
      organizationId: snapshot.organizationId.trim(),
      lock: snapshot.lock ? { ...snapshot.lock } : null,
      latestClosePackage: snapshot.latestClosePackage
        ? { ...snapshot.latestClosePackage }
        : null,
    });
  }

  planClose(input: CloseAccountingPeriodInput) {
    return {
      organizationId: this.snapshot.organizationId,
      periodStart: this.snapshot.month.start,
      periodEnd: this.snapshot.month.endExclusive,
      closeDocumentId: input.closeDocumentId,
      closeReason: input.closeReason?.trim() ?? null,
      closedBy: input.closedBy.trim(),
      closedAt: input.closedAt,
    };
  }

  planReopen(input: ReopenAccountingPeriodInput) {
    const supersededClosePackage = this.snapshot.latestClosePackage
      ? AccountingClosePackage.fromSnapshot(
          this.snapshot.latestClosePackage,
        ).supersede(input.reopenDocumentId).toSnapshot()
      : null;

    return {
      lock: {
        organizationId: this.snapshot.organizationId,
        periodStart: this.snapshot.month.start,
        periodEnd: this.snapshot.month.endExclusive,
        reopenedBy: input.reopenedBy.trim(),
        reopenReason: input.reopenReason?.trim() ?? null,
        reopenedAt: input.reopenedAt,
      },
      supersededClosePackage,
    };
  }
}
