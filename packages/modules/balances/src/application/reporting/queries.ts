import type { BalancesReportingRepository } from "./ports";
import {
  type ListOrganizationLiquidityRowsInput,
  type LiquidityQueryRow,
  ListOrganizationLiquidityRowsInputSchema,
} from "../../contracts";
import type { BalancesQueriesContext } from "../shared/context";

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
    const validated = ListOrganizationLiquidityRowsInputSchema.parse(input);

    return reporting.listOrganizationLiquidityRows(validated);
  };
}

export function createBalancesQueriesFromContext(
  input: BalancesQueriesContext,
): BalancesQueries {
  return createBalancesReportingQueries({
    reporting: input.reporting,
  });
}
