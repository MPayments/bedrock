import type { AccountingChartQueryRepository } from "./ports";
import {
  ChartTemplateAccount,
  CorrespondenceRule,
  PostingMatrix,
} from "../../domain/chart";

export function createListTemplateAccountsQuery(input: {
  repository: AccountingChartQueryRepository;
}) {
  const { repository } = input;

  return async function listTemplateAccounts() {
    const rows = await repository.listTemplateAccountSnapshots();
    return rows.map((row) => ChartTemplateAccount.reconstitute(row).toSnapshot());
  };
}

export function createListCorrespondenceRulesQuery(input: {
  repository: AccountingChartQueryRepository;
}) {
  const { repository } = input;

  return async function listCorrespondenceRules() {
    const rows = await repository.listCorrespondenceRuleSnapshots();
    return rows.map((row) => CorrespondenceRule.reconstitute(row).toSnapshot());
  };
}

export function createValidatePostingMatrixQuery(input: {
  repository: AccountingChartQueryRepository;
}) {
  const { repository } = input;

  return async function validatePostingMatrix() {
    return new PostingMatrix(
      await repository.readPostingMatrixValidationInput(),
    ).validate();
  };
}
