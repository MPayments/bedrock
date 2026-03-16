import {
  createAssertOrganizationPeriodsOpenCommand,
  createClosePeriodCommand,
  createReopenPeriodCommand,
} from "./commands";
import type {
  AccountingClosePackageSnapshotPort,
  AccountingPeriodsCommandRepository,
  AccountingPeriodsQueryRepository,
} from "./ports";
import {
  createIsOrganizationPeriodClosedQuery,
  createListClosedOrganizationIdsForPeriodQuery,
} from "./queries";
import { getPreviousCalendarMonthRange } from "../../domain/periods";

export interface AccountingPeriodsService {
  isOrganizationPeriodClosed: (input: {
    organizationId: string;
    occurredAt: Date;
  }) => Promise<boolean>;
  listClosedOrganizationIdsForPeriod: (input: {
    organizationIds: string[];
    occurredAt: Date;
  }) => Promise<string[]>;
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
    lock: Awaited<
      ReturnType<AccountingPeriodsCommandRepository["upsertClosedPeriodLock"]>
    >;
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
    Awaited<
      ReturnType<AccountingPeriodsCommandRepository["upsertReopenedPeriodLock"]>
    >
  >;
}

export function createAccountingPeriodsHandlers(input: {
  queries: AccountingPeriodsQueryRepository;
  commands: AccountingPeriodsCommandRepository;
  closePackageSnapshotPort: AccountingClosePackageSnapshotPort;
  now?: () => Date;
}): AccountingPeriodsService {
  const { closePackageSnapshotPort } = input;

  const isOrganizationPeriodClosed = createIsOrganizationPeriodClosedQuery({
    repository: input.queries,
  });
  const listClosedOrganizationIdsForPeriod =
    createListClosedOrganizationIdsForPeriodQuery({
      repository: input.queries,
    });
  const assertOrganizationPeriodsOpen =
    createAssertOrganizationPeriodsOpenCommand({
      isOrganizationPeriodClosed,
    });
  const closePeriod = createClosePeriodCommand({
    repository: input.commands,
    closePackageSnapshotPort,
    now: input.now,
  });
  const reopenPeriod = createReopenPeriodCommand({
    repository: input.commands,
    now: input.now,
  });

  return {
    assertOrganizationPeriodsOpen,
    closePeriod,
    isOrganizationPeriodClosed,
    listClosedOrganizationIdsForPeriod,
    reopenPeriod,
  };
}

export { getPreviousCalendarMonthRange };
