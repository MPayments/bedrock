import type { Database } from "@bedrock/platform/persistence";

import { createBalancesQueriesFromContext } from "./application/reporting/queries/list-liquidity";
import { createBalancesQueriesContext } from "./application/shared/context";
import { createDrizzleBalancesReportingRepository } from "./infra/drizzle/repos/balance-reporting-repository";

export function createBalancesQueries(input: { db: Database }) {
  return createBalancesQueriesFromContext({
    ...createBalancesQueriesContext({
      reporting: createDrizzleBalancesReportingRepository(input.db),
    }),
  });
}

export type { BalancesQueries } from "./application/reporting/queries/list-liquidity";
export type {
  LiquidityQueryRow,
  ListOrganizationLiquidityRowsInput,
} from "./contracts";
