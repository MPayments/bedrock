import type {
  AccountingScopedPostingRow,
  LedgerBookRow,
  LiquidityQueryRow,
  ListOrganizationLiquidityRowsInput,
  ListScopedPostingRowsInput,
} from "@bedrock/ledger/contracts";

export interface AccountingBalancesQueryPort {
  listOrganizationLiquidityRows(
    input: ListOrganizationLiquidityRowsInput,
  ): Promise<LiquidityQueryRow[]>;
}

export interface AccountingLedgerQueryPort {
  listBooksById(ids: string[]): Promise<LedgerBookRow[]>;
  listScopedPostingRows(
    input: ListScopedPostingRowsInput,
  ): Promise<AccountingScopedPostingRow[]>;
}
