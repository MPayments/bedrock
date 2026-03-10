import { createQuoteHandlers, type QuoteHandlers } from "./commands/quote";
import { createRateHandlers } from "./commands/rates";
import { createFxServiceContext, type FxServiceDeps } from "./context";

export type FxService = ReturnType<typeof createRateHandlers> & QuoteHandlers;

export function createFxService(deps: FxServiceDeps): FxService {
  const context = createFxServiceContext(deps);
  const rates = createRateHandlers(context);
  const quotes = createQuoteHandlers(context, {
    getCrossRate: rates.getCrossRate,
  });

  return {
    ...rates,
    ...quotes,
  };
}
