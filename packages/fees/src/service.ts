
import { createComponentOperationHandlers } from "./commands/component-ops";
import { createQuoteSnapshotHandlers } from "./commands/quote-snapshot";
import { createRuleHandlers } from "./commands/rules";
import { createFeesServiceContext, type FeesServiceDeps } from "./internal/context";
import { getComponentDefaults } from "./internal/defaults";
import { calculateBpsAmount } from "./internal/math";
import type { FeesService } from "./types";

export type { FeesServiceDeps } from "./internal/context";

export function createFeesService(deps: FeesServiceDeps): FeesService {
    const context = createFeesServiceContext(deps);

    const ruleHandlers = createRuleHandlers(context);
    const quoteSnapshotHandlers = createQuoteSnapshotHandlers(context);
    const componentHandlers = createComponentOperationHandlers();

    return {
        calculateBpsAmount,
        getComponentDefaults,
        ...ruleHandlers,
        ...quoteSnapshotHandlers,
        ...componentHandlers,
    };
}
