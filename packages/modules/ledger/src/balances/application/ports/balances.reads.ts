import type {
  BalanceSnapshot,
  BalanceSubjectInput,
  LiquidityQueryRow,
  ListOrganizationLiquidityRowsInput,
} from "../../contracts";

export interface LedgerBalancesReads {
  getBalancePosition(
    subject: BalanceSubjectInput,
  ): Promise<BalanceSnapshot | null>;
  listOrganizationLiquidityRows(
    input: ListOrganizationLiquidityRowsInput,
  ): Promise<LiquidityQueryRow[]>;
}
