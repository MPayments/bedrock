import type { AccountingChartRepository } from "./ports";
import { validatePostingMatrix as validatePostingMatrixRules } from "../../domain/chart";

export function createListTemplateAccountsQuery(input: {
  repository: AccountingChartRepository;
}) {
  const { repository } = input;

  return async function listTemplateAccounts() {
    return repository.listTemplateAccounts();
  };
}

export function createListCorrespondenceRulesQuery(input: {
  repository: AccountingChartRepository;
}) {
  const { repository } = input;

  return async function listCorrespondenceRules() {
    return repository.listCorrespondenceRules();
  };
}

export function createValidatePostingMatrixQuery(input: {
  repository: AccountingChartRepository;
}) {
  const { repository } = input;

  return async function validatePostingMatrix() {
    return validatePostingMatrixRules(
      await repository.readPostingMatrixValidationInput(),
    );
  };
}
