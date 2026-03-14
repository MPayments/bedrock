import type { Database, Transaction } from "@bedrock/platform/persistence";

import type {
  BalancesQueriesContext,
} from "../../shared/context";
import type {
  BalancesReportingPort,
} from "../../ports";
import type {
  ListOrganizationLiquidityRowsInput,
  LiquidityQueryRow,
} from "../../../contracts";
import {
  validateListOrganizationLiquidityRowsInput,
} from "../../../contracts";

type Queryable = Database | Transaction;

export interface BalancesQueries {
  listOrganizationLiquidityRows: (
    input: ListOrganizationLiquidityRowsInput,
  ) => Promise<LiquidityQueryRow[]>;
}

export function createBalancesReportingQueries(input: {
  reporting: BalancesReportingPort;
}): BalancesQueries {
  return {
    listOrganizationLiquidityRows: createListOrganizationLiquidityRowsQuery(
      input.reporting,
    ),
  };
}

export function createListOrganizationLiquidityRowsQuery(
  reporting: BalancesReportingPort,
) {
  return async function listOrganizationLiquidityRows(
    input: ListOrganizationLiquidityRowsInput,
  ) {
    return reporting.listOrganizationLiquidityRows(
      validateListOrganizationLiquidityRowsInput(input),
    );
  };
}

export function createBalancesQueriesFromContext(
  input: BalancesQueriesContext & { db: Queryable },
): BalancesQueries {
  return createBalancesReportingQueries({
    reporting: input.createReportingRepository(input.db),
  });
}
