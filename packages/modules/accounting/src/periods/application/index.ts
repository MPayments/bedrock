import type { ModuleRuntime } from "@bedrock/shared/core";

import { AssertOrganizationPeriodsOpenCommand } from "./commands/assert-organization-periods-open";
import { ClosePeriodCommand } from "./commands/close-period";
import { ReopenPeriodCommand } from "./commands/reopen-period";
import type { ClosePackageSnapshotPort } from "./ports/close-package-snapshot.port";
import type { PeriodReads } from "./ports/period.reads";
import type { PeriodsCommandUnitOfWork } from "./ports/periods.uow";
import { IsOrganizationPeriodClosedQuery } from "./queries/is-organization-period-closed";
import { ListClosedOrganizationIdsForPeriodQuery } from "./queries/list-closed-organization-ids-for-period";

export interface PeriodsServiceDeps {
  runtime: ModuleRuntime;
  reads: PeriodReads;
  commandUow: PeriodsCommandUnitOfWork;
  closePackageSnapshotPort: ClosePackageSnapshotPort;
}

export function createPeriodsService(input: PeriodsServiceDeps) {
  const isOrganizationPeriodClosed = new IsOrganizationPeriodClosedQuery(
    input.reads,
  );
  const listClosedOrganizationIdsForPeriod =
    new ListClosedOrganizationIdsForPeriodQuery(input.reads);
  const assertOrganizationPeriodsOpen = new AssertOrganizationPeriodsOpenCommand(
    isOrganizationPeriodClosed.execute.bind(isOrganizationPeriodClosed),
  );
  const closePeriod = new ClosePeriodCommand(
    input.runtime,
    input.commandUow,
    input.closePackageSnapshotPort,
  );
  const reopenPeriod = new ReopenPeriodCommand(
    input.runtime,
    input.commandUow,
  );

  return {
    commands: {
      assertOrganizationPeriodsOpen:
        assertOrganizationPeriodsOpen.execute.bind(assertOrganizationPeriodsOpen),
      closePeriod: closePeriod.execute.bind(closePeriod),
      reopenPeriod: reopenPeriod.execute.bind(reopenPeriod),
    },
    queries: {
      isOrganizationPeriodClosed:
        isOrganizationPeriodClosed.execute.bind(isOrganizationPeriodClosed),
      listClosedOrganizationIdsForPeriod:
        listClosedOrganizationIdsForPeriod.execute.bind(
          listClosedOrganizationIdsForPeriod,
        ),
    },
  };
}
