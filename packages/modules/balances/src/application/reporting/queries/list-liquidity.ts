import type {
  Database,
  Queryable,
  Transaction,
} from "@bedrock/platform/persistence";

import type { BalancesQueriesContext } from "../../shared/context";
import type { BalancesReportingRepository } from "../ports";
import type {
  ListOrganizationLiquidityRowsInput,
  LiquidityQueryRow,
} from "../../../contracts";
import { validateListOrganizationLiquidityRowsInput } from "../../../contracts";

export interface BalancesQueries {
  listOrganizationLiquidityRows: (
    input: ListOrganizationLiquidityRowsInput,
  ) => Promise<LiquidityQueryRow[]>;
}

export function createBalancesReportingQueries(input: {
  reporting: BalancesReportingRepository;
}): BalancesQueries {
  return {
    listOrganizationLiquidityRows: createListOrganizationLiquidityRowsQuery(
      input.reporting,
    ),
  };
}

export function createListOrganizationLiquidityRowsQuery(
  reporting: BalancesReportingRepository,
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
