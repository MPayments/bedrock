import type {
  LiquidityQueryRow,
  ListOrganizationLiquidityRowsInput,
  ListOrganizationRequisiteLiquidityRowsInput,
  OrganizationRequisiteLiquidityQueryRow,
} from "../../contracts";

export interface BalancesReportingRepository {
  listOrganizationLiquidityRows(
    input: ListOrganizationLiquidityRowsInput,
  ): Promise<LiquidityQueryRow[]>;
  listOrganizationRequisiteLiquidityRows(
    input: ListOrganizationRequisiteLiquidityRowsInput,
  ): Promise<OrganizationRequisiteLiquidityQueryRow[]>;
}
