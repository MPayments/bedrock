import {
  createAssertOrganizationPeriodsOpenCommand,
  createClosePeriodCommand,
  createReopenPeriodCommand,
} from "./commands";
import type {
  AccountingClosePackageSnapshotPort,
  AccountingPeriodsRepository,
} from "./ports";
import { createIsOrganizationPeriodClosedQuery } from "./queries";
import { getPreviousCalendarMonthRange } from "../../domain/periods";

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
  }) => Promise<
    Awaited<ReturnType<AccountingPeriodsRepository["upsertReopenedPeriodLock"]>>
  >;
}

export function createAccountingPeriodsHandlers(input: {
  repository: AccountingPeriodsRepository;
  closePackageSnapshotPort: AccountingClosePackageSnapshotPort;
}): AccountingPeriodsService {
  const { repository, closePackageSnapshotPort } = input;

  const isOrganizationPeriodClosed = createIsOrganizationPeriodClosedQuery({
    repository,
  });
  const assertOrganizationPeriodsOpen =
    createAssertOrganizationPeriodsOpenCommand({
      isOrganizationPeriodClosed,
    });
  const closePeriod = createClosePeriodCommand({
    repository,
    closePackageSnapshotPort,
  });
  const reopenPeriod = createReopenPeriodCommand({
    repository,
  });

  return {
    assertOrganizationPeriodsOpen,
    closePeriod,
    isOrganizationPeriodClosed,
    reopenPeriod,
  };
}

export { getPreviousCalendarMonthRange };
