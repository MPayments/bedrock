export {
  createDrizzleAccountingChartRepository,
} from "./infra/drizzle/repos/chart-repository";
export { type AccountingService } from "./application/chart";
import { createAccountingChartHandlers } from "./application/chart";
import type { AccountingService } from "./application/chart";
import type { AccountingChartRepository } from "./application/chart/ports";
import type { AccountingPacksService } from "./application/packs";

export interface AccountingServiceDeps {
  repository: AccountingChartRepository;
  packsService: AccountingPacksService;
}

export function createAccountingService(
  deps: AccountingServiceDeps,
): AccountingService {
  return createAccountingChartHandlers(deps);
}
