import type { Logger } from "@bedrock/platform/observability/logger";
import type { Database } from "@bedrock/platform/persistence";

export { type AccountingService } from "./application/chart";
import { createAccountingChartHandlers } from "./application/chart";
import type { AccountingService } from "./application/chart";
import { createDrizzleAccountingChartRepository } from "./infra/drizzle/repos/chart-repository";
import type { AccountingPackDefinition } from "./packs/schema";
import { createAccountingPacksService } from "./packs-service";

export interface AccountingServiceDeps {
  db: Database;
  defaultPackDefinition: AccountingPackDefinition;
  logger?: Logger;
}

export function createAccountingService(
  deps: AccountingServiceDeps,
): AccountingService {
  return createAccountingChartHandlers({
    repository: createDrizzleAccountingChartRepository(deps.db),
    packsService: createAccountingPacksService({
      db: deps.db,
      defaultPackDefinition: deps.defaultPackDefinition,
    }),
  });
}
