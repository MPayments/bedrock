import type { Logger } from "@bedrock/platform/observability/logger";
import {
  createModuleRuntime,
  type Clock,
  type UuidGenerator,
} from "@bedrock/shared/core";

import { createChartService } from "./chart/application";
import type { ChartReads } from "./chart/application/ports/chart.reads";
import type { ChartCommandUnitOfWork } from "./chart/application/ports/chart.uow";
import { createPacksService } from "./packs/application";
import type { CompiledPackCache } from "./packs/application/ports/compiled-pack.cache";
import type { InternalLedgerOrganizationsPort } from "./packs/application/ports/internal-ledger-organizations.port";
import type { PackReads } from "./packs/application/ports/pack.reads";
import type { PacksCommandUnitOfWork } from "./packs/application/ports/packs.uow";
import type { AccountingPackDefinition } from "./packs/domain";
import { createPeriodsService } from "./periods/application";
import type { ClosePackageSnapshotPort } from "./periods/application/ports/close-package-snapshot.port";
import type { PeriodReads } from "./periods/application/ports/period.reads";
import type { PeriodsCommandUnitOfWork } from "./periods/application/ports/periods.uow";
import { createReportsService } from "./reports/application";
import type { ReportsReads } from "./reports/application/ports/reports.reads";

export type AccountingModuleUnitOfWork = ChartCommandUnitOfWork &
  PacksCommandUnitOfWork &
  PeriodsCommandUnitOfWork;

export interface AccountingModuleDeps {
  logger: Logger;
  now: Clock;
  generateUuid: UuidGenerator;
  defaultPackDefinition: AccountingPackDefinition;
  chartReads: ChartReads;
  packReads?: PackReads;
  periodReads: PeriodReads;
  reportsReads: ReportsReads;
  closePackageSnapshotPort: ClosePackageSnapshotPort;
  internalLedgerOrganizations?: InternalLedgerOrganizationsPort;
  compiledPackCache?: CompiledPackCache;
  unitOfWork: AccountingModuleUnitOfWork;
}

export type AccountingModule = ReturnType<typeof createAccountingModule>;

export function createAccountingModule(deps: AccountingModuleDeps) {
  const createRuntime = (service: string) =>
    createModuleRuntime({
      logger: deps.logger,
      now: deps.now,
      generateUuid: deps.generateUuid,
      service,
    });

  return {
    chart: createChartService({
      commandUow: deps.unitOfWork,
      runtime: createRuntime("accounting.chart"),
      reads: deps.chartReads,
    }),
    packs: createPacksService({
      commandUow: deps.unitOfWork,
      runtime: createRuntime("accounting.packs"),
      defaultPackDefinition: deps.defaultPackDefinition,
      reads: deps.packReads,
      cache: deps.compiledPackCache,
      internalLedgerOrganizations: deps.internalLedgerOrganizations,
    }),
    periods: createPeriodsService({
      commandUow: deps.unitOfWork,
      runtime: createRuntime("accounting.periods"),
      reads: deps.periodReads,
      closePackageSnapshotPort: deps.closePackageSnapshotPort,
    }),
    reports: createReportsService({
      reads: deps.reportsReads,
    }),
  };
}
