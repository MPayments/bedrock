import { createComponentOperationHandlers } from "./commands/component-ops";
import { createQuoteSnapshotHandlers } from "./commands/quote-snapshot";
import { createRuleHandlers } from "./commands/rules";
import {
  createFeesServiceContext,
  type FeesServiceDeps,
} from "./context";
import { getComponentDefaults } from "./defaults";
import { calculateBpsAmount } from "./math";
import type { FeesService } from "./types";

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
