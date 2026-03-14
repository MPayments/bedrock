import type { Database, Transaction } from "@bedrock/platform/persistence";

import { createBalancesQueriesFromContext } from "./application/reporting/queries/list-liquidity";
import { createBalancesQueriesContext } from "./application/shared/context";
import { createDrizzleBalancesReportingRepository } from "./infra/drizzle/repos/balance-reporting-repository";

type Queryable = Database | Transaction;

export function createBalancesQueries(input: { db: Queryable }) {
  return createBalancesQueriesFromContext({
    db: input.db,
    ...createBalancesQueriesContext({
      createReportingRepository: createDrizzleBalancesReportingRepository,
    }),
  });
}

export type { BalancesQueries } from "./application/reporting/queries/list-liquidity";
export type {
  LiquidityQueryRow,
  ListOrganizationLiquidityRowsInput,
} from "./contracts";
