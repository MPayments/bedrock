import type { AccountingChartRepository } from "./ports";
import {
  replaceCorrespondenceRulesSchema,
  type ReplaceCorrespondenceRulesInput,
} from "../../contracts/commands";

export function createReplaceCorrespondenceRulesCommand(input: {
  repository: AccountingChartRepository;
}) {
  const { repository } = input;

  return async function replaceCorrespondenceRules(
    command: ReplaceCorrespondenceRulesInput,
  ) {
    const validated = replaceCorrespondenceRulesSchema.parse(command);
    return repository.replaceCorrespondenceRules(validated.rules);
  };
}
