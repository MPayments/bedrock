import type {
  ChartAccountDimensionPolicyRecord,
  ChartTemplateAccountRecord,
  CorrespondenceRuleRecord,
  PostingCodeDimensionPolicyRecord,
} from "../../domain/chart/types";
import type { PostingMatrixValidationInput } from "../../domain/chart/validate-posting-matrix";
import type { ReplaceCorrespondenceRulesInput } from "../../validation";

export interface AccountingChartRepository {
  listTemplateAccounts: () => Promise<ChartTemplateAccountRecord[]>;
  listCorrespondenceRules: () => Promise<CorrespondenceRuleRecord[]>;
  replaceCorrespondenceRules: (
    rules: ReplaceCorrespondenceRulesInput["rules"],
  ) => Promise<CorrespondenceRuleRecord[]>;
  readPostingMatrixValidationInput: () => Promise<
    PostingMatrixValidationInput & {
      accountDimPolicies: ChartAccountDimensionPolicyRecord[];
      postingCodeDimPolicies: PostingCodeDimensionPolicyRecord[];
    }
  >;
}
