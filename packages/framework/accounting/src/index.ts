export {
  ACCOUNT_NO,
  CLEARING_KIND,
  DIM,
  KNOWN_DIMENSION_KEYS,
  CLEARING_KIND_DIMENSION_RULES,
  POSTING_CODE,
  DEFAULT_CHART_TEMPLATE_ACCOUNTS,
  DEFAULT_ACCOUNT_DIMENSION_POLICIES,
  DEFAULT_POSTING_CODE_DIMENSION_POLICIES,
  DEFAULT_GLOBAL_CORRESPONDENCE_RULES,
  type AccountDimensionPolicy,
  type PostingCodeDimensionPolicyEntry,
  type ClearingKindDimensionRule,
  type DimensionMode,
  type DimensionPolicyScope,
  type DimensionKey,
  type Dimensions,
} from "./constants";

export {
  ACCOUNTING_OPERATIONS_LIST_CONTRACT,
  ListAccountingOperationsQuerySchema,
  accountNoSchema,
  correspondenceRuleSchema,
  replaceCorrespondenceRulesSchema,
  type ListAccountingOperationsQuery,
  type ReplaceCorrespondenceRulesInput,
} from "./validation";

export {
  AccountingError,
  AccountingPackVersionConflictError,
  CorrespondenceRuleNotFoundError,
} from "./errors";

export { createAccountingService, type AccountingService } from "./service";
export {
  defineChart,
  defineJournal,
  definePostingTemplate,
  type ChartDefinition,
  type JournalDefinition,
  type PostingTemplateDefinition,
} from "./definitions";
export type { AccountingPackDefinition } from "./packs/schema";
export { AccountingPackDefinitionSchema } from "./packs/schema";
export {
  createAccountingRuntime,
  compilePack as compileAccountingPack,
  validatePackDefinition,
  type AccountingRuntime,
  type CompiledPack,
  type DocumentPostingPlan,
  type DocumentPostingPlanRequest,
  type ResolvePostingPlanInput,
  type ResolvePostingPlanResult,
  type ResolvedPostingTemplate,
} from "./runtime";
export * from "./actions";
export * from "./contracts/accounting-contracts";
export * from "./packs/schema";

export type { AccountingServiceDeps } from "./internal/context";
