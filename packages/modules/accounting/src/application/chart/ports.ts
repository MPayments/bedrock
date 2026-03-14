import type { ReplaceCorrespondenceRulesInput } from "../../contracts/commands";
import type {
  ChartAccountDimensionPolicyRecord,
  ChartTemplateAccountRecord,
  CorrespondenceRuleRecord,
  PostingCodeDimensionPolicyRecord,
  PostingMatrixValidationInput,
} from "../../domain/chart";

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
