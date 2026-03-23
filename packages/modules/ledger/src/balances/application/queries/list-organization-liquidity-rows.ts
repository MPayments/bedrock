import {
  ListOrganizationLiquidityRowsInputSchema,
  type LiquidityQueryRow,
  type ListOrganizationLiquidityRowsInput,
} from "../../contracts";
import type { LedgerBalancesReads } from "../ports/balances.reads";

export class ListOrganizationLiquidityRowsQuery {
  constructor(private readonly reads: LedgerBalancesReads) {}

  execute(
    input: ListOrganizationLiquidityRowsInput,
  ): Promise<LiquidityQueryRow[]> {
    const validated = ListOrganizationLiquidityRowsInputSchema.parse(input);

    return this.reads.listOrganizationLiquidityRows(validated);
  }
}
