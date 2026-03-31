import type { Currency } from "../../contracts";
import type { CurrenciesServiceContext } from "../shared/context";
import { warmCurrenciesCache } from "../shared/warm-cache";

export class FindCurrencyByIdQuery {
  constructor(private readonly context: CurrenciesServiceContext) {}

  async execute(id: string): Promise<Currency | null> {
    const cache = await warmCurrenciesCache(this.context);
    return cache.byId.get(id) ?? null;
  }
}
