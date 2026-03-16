import { ValidationError } from "@bedrock/shared/core/errors";

import type {
  AccountingClosePackageSnapshotPort,
  AccountingPeriodsCommandRepository,
} from "./ports";
import {
  AccountingPeriod,
  CalendarMonth,
  formatPeriodLabel,
  normalizeMonthStart,
} from "../../domain/periods";

export function createAssertOrganizationPeriodsOpenCommand(input: {
  isOrganizationPeriodClosed: (args: {
    organizationId: string;
    occurredAt: Date;
  }) => Promise<boolean>;
}) {
  const { isOrganizationPeriodClosed } = input;

  return async function assertOrganizationPeriodsOpen(command: {
    occurredAt: Date;
    organizationIds: string[];
    docType: string;
  }): Promise<void> {
    if (command.organizationIds.length === 0) {
      return;
    }

    const periodStart = normalizeMonthStart(command.occurredAt);
    const periodLabel = formatPeriodLabel(periodStart);

    for (const organizationId of command.organizationIds) {
      const closed = await isOrganizationPeriodClosed({
        organizationId,
        occurredAt: command.occurredAt,
      });
      if (!closed) {
        continue;
      }

      throw new ValidationError(
        `Accounting period ${periodLabel} is closed for organization ${organizationId}; ${command.docType} cannot be mutated`,
      );
    }
  };
}

export function createClosePeriodCommand(input: {
  repository: AccountingPeriodsCommandRepository;
  closePackageSnapshotPort: AccountingClosePackageSnapshotPort;
  now?: () => Date;
}) {
  const { repository, closePackageSnapshotPort } = input;

  return async function closePeriod(command: {
    organizationId: string;
    periodStart: Date;
    periodEnd: Date;
    closedBy: string;
    closeReason?: string | null;
    closeDocumentId: string;
  }) {
    const month = CalendarMonth.fromDate(command.periodStart);
    const period = AccountingPeriod.reconstitute({
      organizationId: command.organizationId,
      month,
      lock: null,
      latestClosePackage: null,
    });
    const closePlan = period.planClose({
      closeDocumentId: command.closeDocumentId,
      closeReason: command.closeReason,
      closedBy: command.closedBy,
      closedAt: input.now?.() ?? new Date(),
    });

    const lock = await repository.upsertClosedPeriodLock({
      ...closePlan,
    });

    const closePackage =
      await closePackageSnapshotPort.generateClosePackageSnapshot({
        organizationId: closePlan.organizationId,
        periodStart: closePlan.periodStart,
        periodEnd: closePlan.periodEnd,
        closeDocumentId: command.closeDocumentId,
      });

    return {
      lock,
      closePackage,
    };
  };
}

export function createReopenPeriodCommand(input: {
  repository: AccountingPeriodsCommandRepository;
  now?: () => Date;
}) {
  const { repository } = input;

  return async function reopenPeriod(command: {
    organizationId: string;
    periodStart: Date;
    reopenedBy: string;
    reopenReason?: string | null;
    reopenDocumentId?: string | null;
  }) {
    const month = CalendarMonth.fromDate(command.periodStart);
    const latestClosePackage = await repository.findLatestClosePackage({
      organizationId: command.organizationId,
      periodStart: month.start,
    });
    const period = AccountingPeriod.reconstitute({
      organizationId: command.organizationId,
      month,
      lock: null,
      latestClosePackage,
    });
    const reopenPlan = period.planReopen({
      reopenedBy: command.reopenedBy,
      reopenReason: command.reopenReason,
      reopenedAt: input.now?.() ?? new Date(),
      reopenDocumentId: command.reopenDocumentId,
    });

    const lock = await repository.upsertReopenedPeriodLock({
      ...reopenPlan.lock,
    });

    if (reopenPlan.supersededClosePackage) {
      await repository.markClosePackageSuperseded({
        id: reopenPlan.supersededClosePackage.id,
        reopenDocumentId:
          reopenPlan.supersededClosePackage.reopenDocumentId ?? null,
      });
    }

    return lock;
  };
}
