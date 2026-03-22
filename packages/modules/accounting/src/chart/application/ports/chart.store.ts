import type { ReplaceCorrespondenceRulesInput } from "../contracts/commands";
import type { CorrespondenceRuleSnapshot } from "../../domain";

export interface ChartStore {
  replaceCorrespondenceRules(
    rules: ReplaceCorrespondenceRulesInput["rules"],
  ): Promise<CorrespondenceRuleSnapshot[]>;
}
