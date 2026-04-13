import type { Currency } from "../../contracts";
import type { CurrenciesServiceContext } from "../shared/context";
import { warmCurrenciesCache } from "../shared/warm-cache";

export class FindCurrencyByCodeQuery {
  constructor(private readonly context: CurrenciesServiceContext) {}

  async execute(code: string): Promise<Currency | null> {
    const normalizedCode = code.toUpperCase();
    const cache = await warmCurrenciesCache(this.context);
    const cached = cache.byCode.get(normalizedCode);

    if (cached) {
      return cached;
    }

    const fresh = await this.context.queries.findByCode(normalizedCode);
    if (!fresh) {
      return null;
    }

    cache.byId.set(fresh.id, fresh);
    cache.byCode.set(fresh.code, fresh);
    return fresh;
  }
}
