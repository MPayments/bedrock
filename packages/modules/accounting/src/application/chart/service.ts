import {
  createAccountingServiceContext,
  type AccountingServiceDeps,
} from "../shared/context";
import { createAccountingRuntime } from "../packs/runtime";
import {
  replaceCorrespondenceRulesSchema,
  type ReplaceCorrespondenceRulesInput,
} from "../../validation";
import { validatePostingMatrix as validatePostingMatrixRules } from "../../domain/chart/validate-posting-matrix";
import { createDrizzleAccountingChartRepository } from "../../infra/drizzle/repositories/accounting-repository";

export type AccountingService = ReturnType<typeof createAccountingService>;

export function createAccountingService(deps: AccountingServiceDeps) {
  const context = createAccountingServiceContext(deps);
  const repository = createDrizzleAccountingChartRepository(context.db);
  const runtime = createAccountingRuntime(deps);

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
