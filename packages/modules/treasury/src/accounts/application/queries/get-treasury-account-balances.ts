import type { TreasuryCoreServiceContext } from "../../../shared/application/core-context";
import { toTreasuryAccountBalanceDto } from "../../../shared/application/mappers";
import {
  GetTreasuryAccountBalancesInputSchema,
  type GetTreasuryAccountBalancesInput,
} from "../../contracts";

export class GetTreasuryAccountBalancesQuery {
  constructor(private readonly context: TreasuryCoreServiceContext) {}

  async execute(input: GetTreasuryAccountBalancesInput = {}) {
    const validated = GetTreasuryAccountBalancesInputSchema.parse(input);
    const rows = await this.context.reads.listTreasuryAccountBalances(
      validated.accountIds,
    );

    return {
      data: rows.map(toTreasuryAccountBalanceDto),
    };
  }
}
