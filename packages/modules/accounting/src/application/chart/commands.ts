import type { AccountingChartCommandRepository } from "./ports";
import {
  replaceCorrespondenceRulesSchema,
  type ReplaceCorrespondenceRulesInput,
} from "../../contracts/chart/commands";
import {
  CorrespondenceRule,
  type CorrespondenceRuleSnapshot,
} from "../../domain/chart";

export function createReplaceCorrespondenceRulesCommand(input: {
  repository: AccountingChartCommandRepository;
  now?: () => Date;
}) {
  const { repository } = input;

  return async function replaceCorrespondenceRules(
    command: ReplaceCorrespondenceRulesInput,
  ): Promise<CorrespondenceRuleSnapshot[]> {
    const validated = replaceCorrespondenceRulesSchema.parse(command);
    const now = input.now?.() ?? new Date();
    const rows = await repository.replaceCorrespondenceRules(validated.rules);

    return rows.map((row) =>
      CorrespondenceRule.reconstitute({
        ...row,
        createdAt: row.createdAt ?? now,
        updatedAt: row.updatedAt ?? now,
      }).toSnapshot(),
    );
  };
}
