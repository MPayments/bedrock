import { createPolicyHandlers } from "./commands/policy";
import { createQuoteHandlers } from "./commands/quote";
import { createRateHandlers } from "./commands/rates";
import { createFxServiceContext, type FxServiceDeps } from "./internal/context";
import { type FxQuoteDetails } from "./internal/types";

export type FxService = ReturnType<typeof createFxService>;
export type { FxQuoteDetails };

export function createFxService(deps: FxServiceDeps) {
    const context = createFxServiceContext(deps);
    const rates = createRateHandlers(context);
    const policies = createPolicyHandlers(context);
    const quotes = createQuoteHandlers(context, {
        getCrossRate: rates.getCrossRate,
    });

    return {
        ...rates,
        ...policies,
        ...quotes,
    };
}
