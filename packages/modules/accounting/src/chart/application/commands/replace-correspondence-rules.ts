import type { ModuleRuntime } from "@bedrock/shared/core";

import {
  replaceCorrespondenceRulesSchema,
  type ReplaceCorrespondenceRulesInput,
} from "../contracts/commands";
import type { ChartCommandUnitOfWork } from "../ports/chart.uow";
import { CorrespondenceRule } from "../../domain";

export class ReplaceCorrespondenceRulesCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly unitOfWork: ChartCommandUnitOfWork,
  ) {}

  async execute(input: ReplaceCorrespondenceRulesInput) {
    const validated = replaceCorrespondenceRulesSchema.parse(input);

    return this.unitOfWork.run(async (tx) => {
      const now = this.runtime.now();
      const rows = await tx.chart.replaceCorrespondenceRules(validated.rules);

      return rows.map((row) =>
        CorrespondenceRule.fromSnapshot({
          ...row,
          createdAt: row.createdAt ?? now,
          updatedAt: row.updatedAt ?? now,
        }).toSnapshot(),
      );
    });
  }
}
