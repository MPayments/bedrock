import type {
  ChartAccountDimensionPolicyRecord,
  ChartTemplateAccountSnapshot,
  CorrespondenceRuleSnapshot,
  PostingCodeDimensionPolicyRecord,
  PostingMatrixValidationInput,
} from "../../domain";

export interface ChartReads {
  listTemplateAccounts(): Promise<ChartTemplateAccountSnapshot[]>;
  listCorrespondenceRules(): Promise<CorrespondenceRuleSnapshot[]>;
  readPostingMatrix(): Promise<
    PostingMatrixValidationInput & {
      accountDimPolicies: ChartAccountDimensionPolicyRecord[];
      postingCodeDimPolicies: PostingCodeDimensionPolicyRecord[];
    }
  >;
}
