import type { Database } from "@bedrock/platform/persistence";

import {
  createAccountingChartHandlers,
  type AccountingChartService as ApplicationAccountingChartService,
} from "./application/chart";
import type {
  AccountingChartCommandRepository,
  AccountingChartQueryRepository,
} from "./application/chart/ports";
import {
  createAccountingPacksHandlers,
  type AccountingPacksService as ApplicationAccountingPacksService,
} from "./application/packs";
import type {
  AccountingPacksCommandTransaction,
  AccountingPacksCommandRepository,
  AccountingPacksQueryRepository,
  AccountingPacksServicePorts,
} from "./application/packs/ports";
import {
  createAccountingPeriodsHandlers,
  type AccountingPeriodsService as ApplicationAccountingPeriodsService,
} from "./application/periods";
import type {
  AccountingClosePackageSnapshotPort,
  AccountingPeriodsCommandRepository,
  AccountingPeriodsQueryRepository,
} from "./application/periods/ports";
import {
  createAccountingReportsHandlers,
  type AccountingReportsService as ApplicationAccountingReportsService,
} from "./application/reports";
import type {
  AccountingReportsLedgerPort,
  AccountingReportsServicePorts,
} from "./application/reports/ports";
import type { AccountingReportQueries } from "./application/reports/queries/reports";
import type { AccountingPackDefinition } from "./domain/packs";
import {
  createDrizzleAccountingChartCommandRepository,
  createDrizzleAccountingChartQueryRepository,
} from "./infra/drizzle/repos/chart-repository";
import {
  createDrizzleAccountingPacksCommandRepository,
  createDrizzleAccountingPacksQueryRepository,
} from "./infra/drizzle/repos/packs-repository";

export type AccountingChartService = ApplicationAccountingChartService;
export type AccountingPacksService = ApplicationAccountingPacksService;
export type AccountingPeriodsService = ApplicationAccountingPeriodsService;
export type AccountingReportsService = ApplicationAccountingReportsService;

export interface AccountingService {
  chart: AccountingChartService;
  packs: AccountingPacksService;
  periods: AccountingPeriodsService | null;
  reports: AccountingReportsService | null;
}

export interface AccountingServiceDeps {
  chart: AccountingChartService;
  packs: AccountingPacksService;
  periods?: AccountingPeriodsService | null;
  reports?: AccountingReportsService | null;
}

export interface AccountingChartServiceDeps {
  db?: Database;
  now?: () => Date;
  commands?: AccountingChartCommandRepository;
  queries?: AccountingChartQueryRepository;
}

export interface AccountingPacksServiceDeps extends AccountingPacksServicePorts {
  defaultPackDefinition: AccountingPackDefinition;
  db?: Database;
  queries?: AccountingPacksQueryRepository;
  commands?: AccountingPacksCommandRepository;
}

export interface AccountingPeriodsServiceDeps {
  queries: AccountingPeriodsQueryRepository;
  commands: AccountingPeriodsCommandRepository;
  closePackageSnapshotPort: AccountingClosePackageSnapshotPort;
  now?: () => Date;
}

export interface AccountingReportsServiceDeps
  extends AccountingReportsServicePorts {
  ledgerReadPort: AccountingReportsLedgerPort;
  reportQueries: AccountingReportQueries;
}

export function createAccountingChartService(
  deps: AccountingChartServiceDeps,
): AccountingChartService {
  const queries = deps.queries ??
    (deps.db ? createDrizzleAccountingChartQueryRepository(deps.db) : null);
  const commands = deps.commands ??
    (deps.db ? createDrizzleAccountingChartCommandRepository(deps.db) : null);

  if (!queries || !commands) {
    throw new Error(
      "Accounting chart service requires either db or explicit query/command repositories",
    );
  }

  return createAccountingChartHandlers({
    commands,
    queries,
    now: deps.now,
  });
}

export function createAccountingPacksService(
  deps: AccountingPacksServiceDeps,
): AccountingPacksService {
  const queries = deps.queries ??
    (deps.db ? createDrizzleAccountingPacksQueryRepository(deps.db) : undefined);
  const commands = deps.commands ??
    (deps.db
      ? createDrizzleAccountingPacksCommandRepository(deps.db)
      : undefined);

  return createAccountingPacksHandlers({
    ...deps,
    queries,
    commands,
    runInTransaction: deps.runInTransaction ??
      (deps.db
        ? (run) =>
            deps.db!.transaction((tx) =>
              run(tx as unknown as AccountingPacksCommandTransaction),
            )
        : undefined),
  });
}

export function createAccountingPeriodsService(
  deps: AccountingPeriodsServiceDeps,
): AccountingPeriodsService {
  return createAccountingPeriodsHandlers(deps);
}

export function createAccountingReportsService(
  deps: AccountingReportsServiceDeps,
): AccountingReportsService {
  return createAccountingReportsHandlers({
    ledgerReadPort: deps.ledgerReadPort,
    listBookNamesById: deps.listBookNamesById,
    listCurrencyPrecisionsByCode: deps.listCurrencyPrecisionsByCode,
    resolveDimensionLabelsFromRecords: deps.resolveDimensionLabelsFromRecords,
    reportQueries: deps.reportQueries,
  });
}

export function createAccountingService(
  deps: AccountingServiceDeps,
): AccountingService {
  return {
    chart: deps.chart,
    packs: deps.packs,
    periods: deps.periods ?? null,
    reports: deps.reports ?? null,
  };
}
