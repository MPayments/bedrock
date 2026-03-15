import { createReplaceCorrespondenceRulesCommand } from "./commands";
import type {
  AccountingChartCommandRepository,
  AccountingChartQueryRepository,
} from "./ports";
import {
  createListCorrespondenceRulesQuery,
  createListTemplateAccountsQuery,
  createValidatePostingMatrixQuery,
} from "./queries";

export type AccountingChartService = ReturnType<
  typeof createAccountingChartHandlers
>;

export function createAccountingChartHandlers(input: {
  queries: AccountingChartQueryRepository;
  commands: AccountingChartCommandRepository;
  now?: () => Date;
}) {
  const { commands, queries } = input;

  const listTemplateAccounts = createListTemplateAccountsQuery({
    repository: queries,
  });
  const listCorrespondenceRules = createListCorrespondenceRulesQuery({
    repository: queries,
  });
  const replaceCorrespondenceRules = createReplaceCorrespondenceRulesCommand({
    repository: commands,
    now: input.now,
  });
  const validatePostingMatrix = createValidatePostingMatrixQuery({
    repository: queries,
  });

  return {
    listTemplateAccounts,
    listCorrespondenceRules,
    replaceCorrespondenceRules,
    validatePostingMatrix,
  };
}
