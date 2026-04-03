import type {
  BalanceSnapshot,
  BalanceSubjectInput,
  LiquidityQueryRow,
  ListOrganizationLiquidityRowsInput,
  ListOrganizationRequisiteLiquidityRowsInput,
  OrganizationRequisiteLiquidityQueryRow,
} from "../../contracts";

export interface LedgerBalancesReads {
  getBalancePosition(
    subject: BalanceSubjectInput,
  ): Promise<BalanceSnapshot | null>;
  listOrganizationLiquidityRows(
    input: ListOrganizationLiquidityRowsInput,
  ): Promise<LiquidityQueryRow[]>;
  listOrganizationRequisiteLiquidityRows(
    input: ListOrganizationRequisiteLiquidityRowsInput,
  ): Promise<OrganizationRequisiteLiquidityQueryRow[]>;
}
