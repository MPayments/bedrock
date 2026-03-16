import type { ReplaceCorrespondenceRulesInput } from "../../contracts/chart/commands";
import type {
  ChartAccountDimensionPolicyRecord,
  ChartTemplateAccountSnapshot,
  CorrespondenceRuleSnapshot,
  PostingCodeDimensionPolicyRecord,
  PostingMatrixValidationInput,
} from "../../domain/chart";

export interface AccountingChartQueryRepository {
  listTemplateAccountSnapshots: () => Promise<ChartTemplateAccountSnapshot[]>;
  listCorrespondenceRuleSnapshots: () => Promise<CorrespondenceRuleSnapshot[]>;
  readPostingMatrixValidationInput: () => Promise<
    PostingMatrixValidationInput & {
      accountDimPolicies: ChartAccountDimensionPolicyRecord[];
      postingCodeDimPolicies: PostingCodeDimensionPolicyRecord[];
    }
  >;
}

export interface AccountingChartCommandRepository {
  replaceCorrespondenceRules: (
    rules: ReplaceCorrespondenceRulesInput["rules"],
  ) => Promise<CorrespondenceRuleSnapshot[]>;
}
