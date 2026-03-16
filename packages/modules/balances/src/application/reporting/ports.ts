import type {
  LiquidityQueryRow,
  ListOrganizationLiquidityRowsInput,
} from "../../contracts";

export interface BalancesReportingRepository {
  listOrganizationLiquidityRows(
    input: ListOrganizationLiquidityRowsInput,
  ): Promise<LiquidityQueryRow[]>;
}
