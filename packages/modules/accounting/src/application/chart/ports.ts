import type {
  ChartAccountDimensionPolicyRow,
  ChartTemplateAccount,
  CorrespondenceRule,
  PostingCodeDimensionPolicyRow,
} from "../../schema";
import type { ReplaceCorrespondenceRulesInput } from "../../validation";
import type { PostingMatrixValidationInput } from "../../domain/chart/validate-posting-matrix";

export interface AccountingChartRepository {
  listTemplateAccounts: () => Promise<ChartTemplateAccount[]>;
  listCorrespondenceRules: () => Promise<CorrespondenceRule[]>;
  replaceCorrespondenceRules: (
    rules: ReplaceCorrespondenceRulesInput["rules"],
  ) => Promise<CorrespondenceRule[]>;
  readPostingMatrixValidationInput: () => Promise<
    PostingMatrixValidationInput & {
      accountDimPolicies: ChartAccountDimensionPolicyRow[];
      postingCodeDimPolicies: PostingCodeDimensionPolicyRow[];
    }
  >;
}
