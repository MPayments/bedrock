import type { CorrespondenceRuleSnapshot } from "../../domain";
import type { ReplaceCorrespondenceRulesInput } from "../contracts/commands";

export interface ChartStore {
  replaceCorrespondenceRules(
    rules: ReplaceCorrespondenceRulesInput["rules"],
  ): Promise<CorrespondenceRuleSnapshot[]>;
}
