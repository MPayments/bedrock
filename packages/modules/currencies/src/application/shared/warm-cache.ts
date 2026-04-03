import type { CurrenciesServiceContext } from "./context";

export async function warmCurrenciesCache(context: CurrenciesServiceContext) {
  const cached = context.cache.get();
  if (cached) {
    return cached;
  }

  const rows = await context.queries.listAll();
  const next = context.cache.set(rows);
  context.log.debug("currencies cache warmed", { count: rows.length });
  return next;
}
