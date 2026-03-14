import type { AccountingChartRepository } from "./ports";
import { validatePostingMatrix as validatePostingMatrixRules } from "../../domain/chart/validate-posting-matrix";
import {
  replaceCorrespondenceRulesSchema,
  type ReplaceCorrespondenceRulesInput,
} from "../../validation";
import {
  type AccountingRuntime,
} from "../packs/runtime";

export type AccountingService = ReturnType<typeof createAccountingChartService>;

export function createAccountingChartService(input: {
  repository: AccountingChartRepository;
  runtime: AccountingRuntime;
}) {
  const { repository, runtime } = input;
  async function listTemplateAccounts() {
    return repository.listTemplateAccounts();
  }

  async function listCorrespondenceRules() {
    return repository.listCorrespondenceRules();
  }

  async function replaceCorrespondenceRules(
    input: ReplaceCorrespondenceRulesInput,
  ) {
    const validated = replaceCorrespondenceRulesSchema.parse(input);
    return repository.replaceCorrespondenceRules(validated.rules);
  }

  async function validatePostingMatrix() {
    return validatePostingMatrixRules(
      await repository.readPostingMatrixValidationInput(),
    );
  }

  return {
    ...runtime,
    listTemplateAccounts,
    listCorrespondenceRules,
    replaceCorrespondenceRules,
    validatePostingMatrix,
  };
}
