export {
  AssertOrganizationPeriodsOpenInputSchema,
  ClosePeriodInputSchema,
  ReopenPeriodInputSchema,
  type AssertOrganizationPeriodsOpenInput,
  type ClosePeriodInput,
  type ReopenPeriodInput,
} from "./contracts/periods/commands";
export {
  AccountingClosePackageStateSchema,
  AccountingPeriodStateSchema,
} from "./contracts/periods/zod";
export {
  getPreviousCalendarMonthRange,
  type AccountingPeriodsService,
} from "./application/periods";
export type {
  AccountingClosePackageSnapshotPort,
  AccountingPeriodsRepository,
} from "./application/periods/ports";
export { createDrizzleAccountingPeriodsRepository } from "./infra/drizzle/repos/periods-repository";
export {
  createAccountingClosePackageSnapshotPort,
  type AccountingPeriodsDocumentsQueries,
} from "./infra/periods/close-package-snapshot-port";

import {
  createAccountingPeriodsHandlers,
  type AccountingPeriodsService,
} from "./application/periods";
import type {
  AccountingClosePackageSnapshotPort,
  AccountingPeriodsRepository,
} from "./application/periods/ports";

export interface AccountingPeriodsServiceDeps {
  repository: AccountingPeriodsRepository;
  closePackageSnapshotPort: AccountingClosePackageSnapshotPort;
}

export function createAccountingPeriodsService(
  deps: AccountingPeriodsServiceDeps,
): AccountingPeriodsService {
  return createAccountingPeriodsHandlers(deps);
}
