import type { ModuleRuntime } from "@bedrock/shared/core";

import { ReplaceCorrespondenceRulesCommand } from "./commands/replace-correspondence-rules";
import type { ChartReads } from "./ports/chart.reads";
import type { ChartCommandUnitOfWork } from "./ports/chart.uow";
import { ListCorrespondenceRulesQuery } from "./queries/list-correspondence-rules";
import { ListTemplateAccountsQuery } from "./queries/list-template-accounts";
import { ValidatePostingMatrixQuery } from "./queries/validate-posting-matrix";

export interface ChartServiceDeps {
  runtime: ModuleRuntime;
  reads: ChartReads;
  commandUow: ChartCommandUnitOfWork;
}

export function createChartService(deps: ChartServiceDeps) {
  const replaceCorrespondenceRules = new ReplaceCorrespondenceRulesCommand(
    deps.runtime,
    deps.commandUow,
  );
  const listTemplateAccounts = new ListTemplateAccountsQuery(deps.reads);
  const listCorrespondenceRules = new ListCorrespondenceRulesQuery(deps.reads);
  const validatePostingMatrix = new ValidatePostingMatrixQuery(deps.reads);

  return {
    commands: {
      replaceCorrespondenceRules:
        replaceCorrespondenceRules.execute.bind(replaceCorrespondenceRules),
    },
    queries: {
      listTemplateAccounts:
        listTemplateAccounts.execute.bind(listTemplateAccounts),
      listCorrespondenceRules:
        listCorrespondenceRules.execute.bind(listCorrespondenceRules),
      validatePostingMatrix:
        validatePostingMatrix.execute.bind(validatePostingMatrix),
    },
  };
}

export type ChartService = ReturnType<typeof createChartService>;
