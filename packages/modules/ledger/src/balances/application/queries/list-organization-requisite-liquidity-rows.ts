import {
  ListOrganizationRequisiteLiquidityRowsInputSchema,
  type ListOrganizationRequisiteLiquidityRowsInput,
  type OrganizationRequisiteLiquidityQueryRow,
} from "../../contracts";
import type { LedgerBalancesReads } from "../ports/balances.reads";

export class ListOrganizationRequisiteLiquidityRowsQuery {
  constructor(private readonly reads: LedgerBalancesReads) {}

  execute(
    input: ListOrganizationRequisiteLiquidityRowsInput,
  ): Promise<OrganizationRequisiteLiquidityQueryRow[]> {
    const validated = ListOrganizationRequisiteLiquidityRowsInputSchema.parse(input);

    return this.reads.listOrganizationRequisiteLiquidityRows(validated);
  }
}
