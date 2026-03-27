import type { TreasuryCoreServiceContext } from "../../../shared/application/core-context";
import { toTreasuryAccountDto } from "../../../shared/application/mappers";
import {
  ListTreasuryAccountsInputSchema,
  type ListTreasuryAccountsInput,
} from "../../contracts";

export class ListTreasuryAccountsQuery {
  constructor(private readonly context: TreasuryCoreServiceContext) {}

  async execute(input: ListTreasuryAccountsInput = {}) {
    const validated = ListTreasuryAccountsInputSchema.parse(input);
    const records = await this.context.reads.listTreasuryAccounts(validated);

    return records.map(toTreasuryAccountDto);
  }
}
