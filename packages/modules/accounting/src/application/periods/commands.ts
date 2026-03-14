import { ValidationError } from "@bedrock/shared/core/errors";

import type {
  AccountingClosePackageSnapshotPort,
  AccountingPeriodsRepository,
} from "./ports";
import {
  formatPeriodLabel,
  normalizeMonthEndExclusive,
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
  repository: AccountingPeriodsRepository;
  closePackageSnapshotPort: AccountingClosePackageSnapshotPort;
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
    const periodStart = normalizeMonthStart(command.periodStart);
    const periodEnd = normalizeMonthEndExclusive(command.periodEnd);

    const lock = await repository.upsertClosedPeriodLock({
      organizationId: command.organizationId,
      periodStart,
      periodEnd,
      closeDocumentId: command.closeDocumentId,
      closeReason: command.closeReason ?? null,
      closedBy: command.closedBy,
      closedAt: new Date(),
    });

    const closePackage =
      await closePackageSnapshotPort.generateClosePackageSnapshot({
        organizationId: command.organizationId,
        periodStart,
        periodEnd,
        closeDocumentId: command.closeDocumentId,
      });

    return {
      lock,
      closePackage,
    };
  };
}

export function createReopenPeriodCommand(input: {
  repository: AccountingPeriodsRepository;
}) {
  const { repository } = input;

  return async function reopenPeriod(command: {
    organizationId: string;
    periodStart: Date;
    reopenedBy: string;
    reopenReason?: string | null;
    reopenDocumentId?: string | null;
  }) {
    const periodStart = normalizeMonthStart(command.periodStart);

    const lock = await repository.upsertReopenedPeriodLock({
      organizationId: command.organizationId,
      periodStart,
      periodEnd: normalizeMonthEndExclusive(periodStart),
      reopenedBy: command.reopenedBy,
      reopenReason: command.reopenReason ?? null,
      reopenedAt: new Date(),
    });

    const latestClosePackage = await repository.findLatestClosePackage({
      organizationId: command.organizationId,
      periodStart,
    });

    if (latestClosePackage) {
      await repository.markClosePackageSuperseded({
        id: latestClosePackage.id,
        reopenDocumentId: command.reopenDocumentId ?? null,
      });
    }

    return lock;
  };
}
