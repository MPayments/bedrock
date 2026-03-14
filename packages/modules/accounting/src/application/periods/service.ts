import { ValidationError } from "@bedrock/shared/core/errors";

import type {
  AccountingClosePackageSnapshotPort,
  AccountingPeriodsRepository,
} from "./ports";
import {
  formatPeriodLabel,
  getPreviousCalendarMonthRange,
  normalizeMonthEndExclusive,
  normalizeMonthStart,
} from "../../domain/periods/month";

export interface AccountingPeriodsService {
  isOrganizationPeriodClosed: (input: {
    organizationId: string;
    occurredAt: Date;
  }) => Promise<boolean>;
  assertOrganizationPeriodsOpen: (input: {
    occurredAt: Date;
    organizationIds: string[];
    docType: string;
  }) => Promise<void>;
  closePeriod: (input: {
    organizationId: string;
    periodStart: Date;
    periodEnd: Date;
    closedBy: string;
    closeReason?: string | null;
    closeDocumentId: string;
  }) => Promise<{
    lock: Awaited<ReturnType<AccountingPeriodsRepository["upsertClosedPeriodLock"]>>;
    closePackage: Awaited<
      ReturnType<AccountingClosePackageSnapshotPort["generateClosePackageSnapshot"]>
    >;
  }>;
  reopenPeriod: (input: {
    organizationId: string;
    periodStart: Date;
    reopenedBy: string;
    reopenReason?: string | null;
    reopenDocumentId?: string | null;
  }) => Promise<Awaited<ReturnType<AccountingPeriodsRepository["upsertReopenedPeriodLock"]>>>;
}

export function createAccountingPeriodsHandlers(input: {
  repository: AccountingPeriodsRepository;
  closePackageSnapshotPort: AccountingClosePackageSnapshotPort;
}): AccountingPeriodsService {
  const { repository, closePackageSnapshotPort } = input;

  async function isOrganizationPeriodClosed(inputArgs: {
    organizationId: string;
    occurredAt: Date;
  }): Promise<boolean> {
    const periodStart = normalizeMonthStart(inputArgs.occurredAt);
    return Boolean(
      await repository.findClosedPeriodLock({
        organizationId: inputArgs.organizationId,
        periodStart,
      }),
    );
  }

  async function assertOrganizationPeriodsOpen(inputArgs: {
    occurredAt: Date;
    organizationIds: string[];
    docType: string;
  }): Promise<void> {
    if (inputArgs.organizationIds.length === 0) {
      return;
    }

    const periodStart = normalizeMonthStart(inputArgs.occurredAt);
    const periodLabel = formatPeriodLabel(periodStart);

    for (const organizationId of inputArgs.organizationIds) {
      const closed = await isOrganizationPeriodClosed({
        organizationId,
        occurredAt: inputArgs.occurredAt,
      });
      if (!closed) {
        continue;
      }

      throw new ValidationError(
        `Accounting period ${periodLabel} is closed for organization ${organizationId}; ${inputArgs.docType} cannot be mutated`,
      );
    }
  }

  async function closePeriod(inputArgs: {
    organizationId: string;
    periodStart: Date;
    periodEnd: Date;
    closedBy: string;
    closeReason?: string | null;
    closeDocumentId: string;
  }) {
    const periodStart = normalizeMonthStart(inputArgs.periodStart);
    const periodEnd = normalizeMonthEndExclusive(inputArgs.periodEnd);

    const lock = await repository.upsertClosedPeriodLock({
      organizationId: inputArgs.organizationId,
      periodStart,
      periodEnd,
      closeDocumentId: inputArgs.closeDocumentId,
      closeReason: inputArgs.closeReason ?? null,
      closedBy: inputArgs.closedBy,
      closedAt: new Date(),
    });

    const closePackage =
      await closePackageSnapshotPort.generateClosePackageSnapshot({
        organizationId: inputArgs.organizationId,
        periodStart,
        periodEnd,
        closeDocumentId: inputArgs.closeDocumentId,
      });

    return {
      lock,
      closePackage,
    };
  }

  async function reopenPeriod(inputArgs: {
    organizationId: string;
    periodStart: Date;
    reopenedBy: string;
    reopenReason?: string | null;
    reopenDocumentId?: string | null;
  }) {
    const periodStart = normalizeMonthStart(inputArgs.periodStart);

    const lock = await repository.upsertReopenedPeriodLock({
      organizationId: inputArgs.organizationId,
      periodStart,
      periodEnd: normalizeMonthEndExclusive(periodStart),
      reopenedBy: inputArgs.reopenedBy,
      reopenReason: inputArgs.reopenReason ?? null,
      reopenedAt: new Date(),
    });

    const latestClosePackage = await repository.findLatestClosePackage({
      organizationId: inputArgs.organizationId,
      periodStart,
    });

    if (latestClosePackage) {
      await repository.markClosePackageSuperseded({
        id: latestClosePackage.id,
        reopenDocumentId: inputArgs.reopenDocumentId ?? null,
      });
    }

    return lock;
  }

  return {
    assertOrganizationPeriodsOpen,
    closePeriod,
    isOrganizationPeriodClosed,
    reopenPeriod,
  };
}

export { getPreviousCalendarMonthRange };
