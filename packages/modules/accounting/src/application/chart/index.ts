import type { AccountingPacksService } from "../packs";
import { createReplaceCorrespondenceRulesCommand } from "./commands";
import type { AccountingChartRepository } from "./ports";
import {
  createListCorrespondenceRulesQuery,
  createListTemplateAccountsQuery,
  createValidatePostingMatrixQuery,
} from "./queries";

export type AccountingService = ReturnType<typeof createAccountingChartHandlers>;

export function createAccountingChartHandlers(input: {
  repository: AccountingChartRepository;
  packsService: AccountingPacksService;
}) {
  const { repository, packsService } = input;

  const listTemplateAccounts = createListTemplateAccountsQuery({ repository });
  const listCorrespondenceRules = createListCorrespondenceRulesQuery({
    repository,
  });
  const replaceCorrespondenceRules = createReplaceCorrespondenceRulesCommand({
    repository,
  });
  const validatePostingMatrix = createValidatePostingMatrixQuery({
    repository,
  });

  return {
    ...packsService,
    listTemplateAccounts,
    listCorrespondenceRules,
    replaceCorrespondenceRules,
    validatePostingMatrix,
  };
}
