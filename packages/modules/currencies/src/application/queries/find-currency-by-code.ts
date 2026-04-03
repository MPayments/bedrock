import type { Currency } from "../../contracts";
import type { CurrenciesServiceContext } from "../shared/context";
import { warmCurrenciesCache } from "../shared/warm-cache";

export class FindCurrencyByCodeQuery {
  constructor(private readonly context: CurrenciesServiceContext) {}

  async execute(code: string): Promise<Currency | null> {
    const cache = await warmCurrenciesCache(this.context);
    return cache.byCode.get(code.toUpperCase()) ?? null;
  }
}
