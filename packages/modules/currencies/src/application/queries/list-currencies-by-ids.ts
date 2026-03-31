import type { Currency } from "../../contracts";
import type { CurrenciesQueriesContext } from "../shared/context";

export class ListCurrenciesByIdsQuery {
  constructor(private readonly context: CurrenciesQueriesContext) {}

  async execute(ids: string[]): Promise<Map<string, Currency>> {
    const uniqueIds = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));

    if (uniqueIds.length === 0) {
      return new Map();
    }

    return this.context.queries.listByIds(uniqueIds);
  }
}
