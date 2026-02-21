import { createQuoteHandlers } from "./commands/quote";
import { createRateHandlers } from "./commands/rates";
import { createFxServiceContext, type FxServiceDeps } from "./internal/context";

export type FxService = ReturnType<typeof createFxService>;

export function createFxService(deps: FxServiceDeps) {
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
