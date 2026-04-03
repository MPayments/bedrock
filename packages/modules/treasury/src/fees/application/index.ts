import {
  type ModuleRuntime,
} from "@bedrock/shared/core";

import { CreateFeeRuleCommand } from "./commands/create-fee-rule";
import type {
  FeeRulesReads,
  FeeRulesStore,
  FeesCurrenciesPort,
} from "./ports";
import { CalculateQuoteFeeComponentsQuery } from "./queries/calculate-quote-fee-components";
import { ListApplicableRulesQuery } from "./queries/list-applicable-rules";

export interface FeesServiceDeps {
  runtime: ModuleRuntime;
  currencies: FeesCurrenciesPort;
  rulesReads: FeeRulesReads;
  rulesStore: FeeRulesStore;
}

export function createFeesService(deps: FeesServiceDeps) {
  const createFeeRule = new CreateFeeRuleCommand(
    deps.runtime,
    deps.currencies,
    deps.rulesStore,
  );
  const listApplicableRules = new ListApplicableRulesQuery(
    deps.currencies,
    deps.rulesReads,
  );
  const calculateQuoteFeeComponents = new CalculateQuoteFeeComponentsQuery(
    deps.currencies,
    deps.rulesReads,
  );

  return {
    commands: {
      createFeeRule: createFeeRule.execute.bind(createFeeRule),
    },
    queries: {
      listApplicableRules:
        listApplicableRules.execute.bind(listApplicableRules),
      calculateQuoteFeeComponents:
        calculateQuoteFeeComponents.execute.bind(calculateQuoteFeeComponents),
    },
  };
}

export type FeesService = ReturnType<typeof createFeesService>;
