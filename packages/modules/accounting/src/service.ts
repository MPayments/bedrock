export {
  type AccountingService,
} from "./application/chart/service";
import { createAccountingChartService } from "./application/chart/service";
import type { AccountingService } from "./application/chart/service";
import {
  type AccountingServiceDeps,
} from "./deps";
import { createDrizzleAccountingChartRepository } from "./infra/drizzle/repos/chart-repository";
import { createAccountingRuntime } from "./runtime";

export function createAccountingService(deps: AccountingServiceDeps): AccountingService {
  return createAccountingChartService({
    repository: createDrizzleAccountingChartRepository(deps.db),
    runtime: createAccountingRuntime(deps),
  });
}
