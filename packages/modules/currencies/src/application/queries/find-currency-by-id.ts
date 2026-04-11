import type { Currency } from "../../contracts";
import type { CurrenciesServiceContext } from "../shared/context";
import { warmCurrenciesCache } from "../shared/warm-cache";

export class FindCurrencyByIdQuery {
  constructor(private readonly context: CurrenciesServiceContext) {}

  async execute(id: string): Promise<Currency | null> {
    const cache = await warmCurrenciesCache(this.context);
    const cached = cache.byId.get(id);

    if (cached) {
      return cached;
    }

    const fresh = await this.context.queries.findById(id);
    if (!fresh) {
      return null;
    }

    cache.byId.set(fresh.id, fresh);
    cache.byCode.set(fresh.code, fresh);
    return fresh;
  }
}
